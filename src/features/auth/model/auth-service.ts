import { deriveRegistrationKeys } from '@/features/auth/model/registration-crypto'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { fetchLoginSalts, updateMasterKeyEnvelope, fetchFreshEnvelope } from '@/shared/api/supabase-keys'
import { hexDecode, hexEncode } from '@/shared/crypto/crypto-utils'
import { deriveAuthHash } from '@/shared/crypto/split-kdf'
import { rewrapMasterKey } from '@/shared/crypto/master-key'
import { terminateWorker } from '@/shared/crypto/argon2id'
import { keyVault } from '@/shared/crypto/key-vault'

/**
 * Registers a new user: derives keys, signs up on the server, uploads encrypted
 * key material, and populates the auth and crypto stores. Returns the BIP-39
 * mnemonic for the recovery dialog.
 *
 * On failure after signup, attempts best-effort cleanup via logout.
 */
export async function signUpUser(username: string, password: string): Promise<string> {
  const authStore = useAuthStore.getState()
  authStore.setLoading(true)

  try {
    const regResult = await deriveRegistrationKeys(password)
    const authResult = await authAdapter.signup(username, regResult.authHash)

    try {
      await uploadRegistrationData(regResult, authResult.user.id)
    } catch (error) {
      // Signup succeeded but upload failed — best-effort cleanup
      try {
        await authAdapter.logout()
      } catch {
        // Server signOut may fail — ignore
      }
      throw error
    }

    authStore.setAuth(authResult.user, authResult.session)

    // Store KEK and field keys in the vault (non-extractable CryptoKeys)
    keyVault.storeKey('kek', regResult.vault.kek)
    keyVault.storeFieldKeys(regResult.vault.fieldKeys)

    useCryptoStore.getState().setCachedEnvelope({
      authHashSalt: hexEncode(regResult.keyEnvelope.authHashSalt),
      passwordKeySalt: hexEncode(regResult.keyEnvelope.passwordKeySalt),
      wrappedMasterKey: hexEncode(regResult.keyEnvelope.wrappedMasterKey),
      masterKeyIV: hexEncode(regResult.keyEnvelope.masterKeyIV),
      fieldKeys: regResult.wrappedFieldKeys.map((fk) => ({
        fieldName: fk.fieldName,
        version: fk.version,
        wrappedFieldKey: hexEncode(fk.wrappedFieldKey),
        fieldKeyIV: hexEncode(fk.fieldKeyIV),
      })),
    })

    return regResult.recovery.mnemonic
  } finally {
    authStore.setLoading(false)
  }
}

/**
 * Logs in an existing user (salts are fetched pre-auth).
 */
export async function loginUser(username: string, password: string) {
  const authStore = useAuthStore.getState()
  authStore.setLoading(true)

  try {
    // Fetch salts (pre-auth) → derive credentials → authenticate
    const { authHashSalt } = await fetchLoginSalts(username)
    const authHash = await deriveAuthHash(password, hexDecode(authHashSalt))
    const authResult = await authAdapter.login(username, authHash)

    // Fetch wrapped keys (post-auth) → derive KEK → unwrap and store field keys
    await keyVault.unlockVault(authResult.user.id, password)

    authStore.setAuth(authResult.user, authResult.session)
  } finally {
    authStore.setLoading(false)
  }
}

/**
 * Changes the user's password by re-wrapping the master key.
 *
 * The master key itself never changes — only its wrapping with the new
 * password-derived key. Field keys (encrypted with KEK) are unaffected.
 *
 * Flow:
 * 1. Pure crypto: unwrap master key with old password, re-wrap with new
 * 2. Upload new key envelope to DB
 * 3. Update Supabase Auth password (new auth hash)
 * 4. Update cached envelope in crypto store
 *
 * If step 3 fails after step 2 succeeds, attempts to roll back the DB update
 * with the old envelope values. If rollback also fails, forces logout.
 */
export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  const { user } = useAuthStore.getState()

  if (!user) throw new Error('No authenticated user')

  const envelope = useCryptoStore.getState().cachedEnvelope ?? (await fetchFreshEnvelope(user.id))

  // Step 1: Pure crypto — derive new credentials and re-wrap master key
  const result = await rewrapMasterKey(currentPassword, newPassword, envelope)

  // Step 2: Upload new key envelope to DB
  const updateData = {
    authHashSalt: hexEncode(result.newAuthHashSalt),
    passwordKeySalt: hexEncode(result.newPasswordKeySalt),
    wrappedMasterKey: hexEncode(result.newWrappedMasterKey),
    masterKeyIV: hexEncode(result.newMasterKeyIV),
  }

  await updateMasterKeyEnvelope(user.id, updateData)

  // Step 3: Update Supabase Auth password
  try {
    await authAdapter.updatePassword(result.newAuthHash)
  } catch (authError) {
    // Auth update failed — DB has new keys but auth still uses old hash.
    // Attempt rollback of DB update.
    try {
      await updateMasterKeyEnvelope(user.id, {
        authHashSalt: envelope.authHashSalt,
        passwordKeySalt: envelope.passwordKeySalt,
        wrappedMasterKey: envelope.wrappedMasterKey,
        masterKeyIV: envelope.masterKeyIV,
      })
    } catch {
      // Rollback failed — force logout to prevent inconsistent state
      await logoutUser()
      throw new Error('Password update partially failed. Please log in again.')
    }
    throw authError
  }

  // Step 4: Update cached envelope with new values
  useCryptoStore.getState().setCachedEnvelope({
    ...envelope,
    authHashSalt: updateData.authHashSalt,
    passwordKeySalt: updateData.passwordKeySalt,
    wrappedMasterKey: updateData.wrappedMasterKey,
    masterKeyIV: updateData.masterKeyIV,
  })
}

function logoutCleanup() {
  keyVault.clearVault()
  useAuthStore.getState().reset()
  terminateWorker()
}

export async function logoutUser() {
  const store = useAuthStore.getState()
  store.setLoading(true)

  try {
    await authAdapter.logout()
  } catch {
    // Server signOut may fail (no session, network error) - clear local state regardless
  } finally {
    logoutCleanup()
  }
}

let restoring = false

/**
 * Restores the existing user session on app boot, guards against concurrent calls,
 * and marks session restoration as complete.
 */
export async function restoreSession(): Promise<void> {
  if (restoring) return
  const { isRestoringSession } = useAuthStore.getState()
  if (!isRestoringSession) return

  restoring = true

  try {
    const result = await authAdapter.getSession()
    if (result) {
      useAuthStore.getState().setAuth(result.user, result.session)
    }
  } catch {
    // getSession failed — proceed as unauthenticated
  } finally {
    useAuthStore.getState().setRestoringSession(false)
    restoring = false
  }
}

/**
 * Subscribes to auth state changes from the adapter and syncs the
 * current user/session into the auth store.
 *
 * @remarks The underlying Supabase listener broadcasts auth events across
 * browser tabs, so a logout (or login) in one tab is reflected in all others.
 *
 * @returns A function to unsubscribe from auth state changes.
 */
export function subscribeToAuthChanges(): () => void {
  return authAdapter.onAuthStateChange((result) => {
    if (result) {
      useAuthStore.getState().setAuth(result.user, result.session)
    } else {
      logoutCleanup()
    }
  })
}
