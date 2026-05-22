import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { getLoginSalts, getKeys, getFieldKeys } from '@/shared/api/supabase-keys'
import { deriveLoginCredentials } from '@/shared/crypto/split-kdf'
import { deriveLoginKeys } from '@/features/encryption/model/login'
import { hexDecode, hexEncode } from '@/shared/crypto/memory'
import { exportKey } from '@/shared/crypto/aes-gcm'
import { lockVault } from '@/features/encryption/model/vault-lock'

function encodeFieldKeysToHex(fieldKeys: Map<string, Uint8Array>): Record<string, string> {
  return Object.fromEntries(Array.from(fieldKeys.entries()).map(([name, key]) => [name, hexEncode(key)]))
}

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

    const masterKeyHex = hexEncode(regResult.masterKey)
    const kekHex = hexEncode(regResult.kek)
    const fieldKeysHex = encodeFieldKeysToHex(regResult.fieldKeys)
    useCryptoStore.getState().setKeys(masterKeyHex, kekHex, fieldKeysHex)

    return regResult.mnemonic
  } finally {
    authStore.setLoading(false)
  }
}

export async function loginUser(username: string, password: string) {
  const authStore = useAuthStore.getState()
  authStore.setLoading(true)

  try {
    // 1. Fetch salts (pre-auth, via RPC)
    const salts = await getLoginSalts(username)

    // 2. Derive authHash + passwordKey from password + salts
    const { authHash, passwordKey } = await deriveLoginCredentials(
      password,
      hexDecode(salts.authSalt),
      hexDecode(salts.keySalt),
    )

    // 3. Authenticate with Supabase Auth
    const authResult = await authAdapter.login(username, authHash)

    // 4. Fetch wrapped key material (post-auth, RLS-protected)
    const [serverKeys, serverFieldKeys] = await Promise.all([
      getKeys(authResult.user.id),
      getFieldKeys(authResult.user.id),
    ])

    // 5. Unwrap all keys (pure crypto)
    const loginResult = await deriveLoginKeys(
      passwordKey,
      hexDecode(serverKeys.wrappedMasterKey),
      hexDecode(serverKeys.masterKeyIV),
      serverFieldKeys,
    )

    // 6. Hex-encode and store in crypto store
    const kekBytes = await exportKey(loginResult.kek)
    useCryptoStore
      .getState()
      .setKeys(hexEncode(loginResult.masterKey), hexEncode(kekBytes), encodeFieldKeysToHex(loginResult.fieldKeys))

    // 7. Set auth state
    authStore.setAuth(authResult.user, authResult.session)

    return authResult
  } finally {
    authStore.setLoading(false)
  }
}

export async function logoutUser() {
  const store = useAuthStore.getState()
  store.setLoading(true)

  try {
    await authAdapter.logout()
  } catch {
    // Server signOut may fail (no session, network error) - clear local state regardless
  } finally {
    lockVault()
    store.reset()
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
      lockVault()
      useAuthStore.getState().reset()
    }
  })
}
