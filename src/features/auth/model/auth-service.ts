import { deriveRegistrationKeys } from '@/features/auth/model/registration-crypto'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { AuthErrorCode, isAuthError } from '@/shared/auth/auth-errors'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { fetchLoginSalts, updateMasterKeyEnvelope, fetchFreshEnvelope } from '@/shared/api/supabase-keys'
import { hexDecode, hexEncode, zeroFill } from '@/shared/crypto/core/crypto-utils'
import { deriveAuthCredentials } from '@/shared/crypto/keys/split-kdf'
import { rewrapMasterKey } from '@/shared/crypto/keys/master-key'
import { terminateWorker } from '@/shared/crypto/core/argon2id'
import { keyVault } from '@/shared/crypto/vault/key-vault'
import { sessionUpdateChannel } from '@/shared/realtime/session-update'

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
      kdfSalt: hexEncode(regResult.keyEnvelope.kdfSalt),
      wrappedMasterKey: hexEncode(regResult.keyEnvelope.wrappedMasterKey),
      masterKeyIV: hexEncode(regResult.keyEnvelope.masterKeyIV),
      fieldKeys: regResult.wrappedFieldKeys.map((fk) => ({
        fieldName: fk.fieldName,
        version: fk.version,
        wrappedFieldKey: hexEncode(fk.wrappedFieldKey),
        fieldKeyIV: hexEncode(fk.fieldKeyIV),
      })),
    })

    sessionUpdateChannel.broadcastUpdate(authResult.user.id)

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
    // Fetch salt (pre-auth) → derive credentials → authenticate
    const { kdfSalt } = await fetchLoginSalts(username)
    const { authHash, passwordKey } = await deriveAuthCredentials(password, hexDecode(kdfSalt))
    const authResult = await authAdapter.login(username, authHash)

    // Fetch wrapped keys (post-auth) → derive KEK → unwrap and store field keys
    await keyVault.initVault(authResult.user.id, passwordKey)
    zeroFill(passwordKey)

    authStore.setAuth(authResult.user, authResult.session)

    sessionUpdateChannel.broadcastUpdate(authResult.user.id)
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
    kdfSalt: hexEncode(result.newKdfSalt),
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
        kdfSalt: envelope.kdfSalt,
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
    kdfSalt: updateData.kdfSalt,
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
  let userId

  try {
    userId = useAuthStore.getState().user?.id
    await authAdapter.logout()
  } catch {
    // Server signOut may fail (no session, network error) - clear local state regardless
  } finally {
    if (userId) sessionUpdateChannel.broadcastUpdate(userId)
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
 * Deletes the authenticated user's account and all associated data.
 *
 * Verifies the password by re-deriving the auth hash and calling login.
 * If the password is wrong, throws AuthError(INVALID_CREDENTIALS).
 * If the password is correct, calls the server-side delete_account RPC
 * (which cascades through all user data), then clears all local state.
 */
export async function deleteUserAccount(password: string): Promise<void> {
  const { user } = useAuthStore.getState()
  if (!user) throw new Error('No authenticated user')

  // 1. Verify the password by re-deriving authHash and attempting login.
  //    This prevents accidental deletion from an unlocked session.
  const { kdfSalt } = await fetchLoginSalts(user.username)
  const { authHash } = await deriveAuthCredentials(password, hexDecode(kdfSalt))

  try {
    await authAdapter.login(user.username, authHash)
  } catch (error) {
    if (isAuthError(error) && error.code === AuthErrorCode.INVALID_CREDENTIALS) {
      throw error
    }
    throw error
  }

  // 2. Delete the account (server-side RPC + signOut)
  await authAdapter.deleteAccount()

  // 3. Clear all local state
  logoutCleanup()
}

/**
 * Subscribes to auth state changes from the adapter and syncs the
 * current user/session into the auth store.
 *
 * @remarks The underlying Supabase listener broadcasts auth events across
 * browser tabs, so a logout (or login) in one tab is reflected in all others.
 *
 * @param onSignOut Callback invoked after local state is cleared on sign-out
 *   (e.g. to navigate to the login page). Called for both same-tab and
 *   cross-tab sign-outs.
 *
 * @returns A function to unsubscribe from auth state changes.
 */
export function subscribeToAuthChanges(onSignOut: () => void): () => void {
  return authAdapter.onAuthStateChange((result) => {
    if (result) {
      useAuthStore.getState().setAuth(result.user, result.session)
    } else {
      const wasAuthenticated = useAuthStore.getState().user !== null
      logoutCleanup()
      if (wasAuthenticated) {
        onSignOut()
      }
    }
  })
}
