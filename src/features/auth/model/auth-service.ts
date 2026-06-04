import { deriveRegistrationKeys } from '@/features/auth/model/registration-crypto'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { fetchLoginSalts } from '@/shared/api/supabase-keys'
import { hexDecode, hexEncode } from '@/shared/crypto/crypto-utils'
import { deriveAuthHash, terminateWorker } from '@/shared/crypto/argon2id'
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
    keyVault.storeKey('kek', regResult.kek)
    keyVault.storeFieldKeys(regResult.fieldKeys)

    useCryptoStore.getState().setCachedEnvelope({
      authSalt: hexEncode(regResult.authSalt),
      keySalt: hexEncode(regResult.keySalt),
      wrappedMasterKey: hexEncode(regResult.wrappedMasterKey),
      masterKeyIV: hexEncode(regResult.masterKeyIV),
      fieldKeys: regResult.wrappedFieldKeys.map((fk) => ({
        fieldName: fk.fieldName,
        version: fk.version,
        wrappedKey: hexEncode(fk.wrappedKey),
        keyIV: hexEncode(fk.iv),
      })),
    })

    return regResult.mnemonic
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
    const { authSalt } = await fetchLoginSalts(username)
    const authHash = await deriveAuthHash(password, hexDecode(authSalt))
    const authResult = await authAdapter.login(username, authHash)

    // Fetch wrapped keys (post-auth) → derive KEK → unwrap and store field keys
    await keyVault.unlockVault(authResult.user.id, password)

    authStore.setAuth(authResult.user, authResult.session)
  } finally {
    authStore.setLoading(false)
  }
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
