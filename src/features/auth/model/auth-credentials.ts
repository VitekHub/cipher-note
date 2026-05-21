import { useAuthStore } from '@/features/auth/model/auth-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { deriveCredentials } from '@/shared/crypto/derive-placeholder'
import type { AuthResult } from '@/shared/auth/auth.types'

export async function signUpUser(username: string, authHash: string): Promise<AuthResult> {
  const store = useAuthStore.getState()
  store.setLoading(true)

  try {
    const authResult = await authAdapter.signup(username, authHash)
    store.setAuth(authResult.user, authResult.session)
    return authResult
  } finally {
    store.setLoading(false)
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
