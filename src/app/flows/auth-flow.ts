import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { deriveCredentials } from '@/shared/crypto/derive-placeholder'
import type { AuthResult } from '@/shared/auth/auth.types'
import { hexEncode } from '@/shared/crypto/memory'

function encodeFieldKeysToHex(fieldKeys: Map<string, Uint8Array>): Record<string, string> {
  const mapEntries = Array.from(fieldKeys.entries())
  const hexEntries = mapEntries.map(([name, key]) => {
    const hexKey = hexEncode(key)
    return [name, hexKey]
  })
  return Object.fromEntries(hexEntries)
}

export async function signUpUser(username: string, password: string): Promise<AuthResult & { mnemonic: string }> {
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

    return { ...authResult, mnemonic: regResult.mnemonic }
  } finally {
    authStore.setLoading(false)
  }
}

export async function loginUser(username: string, password: string) {
  const store = useAuthStore.getState()
  store.setLoading(true)

  try {
    const creds = await deriveCredentials(username, password)
    const result = await authAdapter.login(username, creds.authHash)
    store.setAuth(result.user, result.session)
    return result
  } finally {
    store.setLoading(false)
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
      useAuthStore.getState().reset()
    }
  })
}
