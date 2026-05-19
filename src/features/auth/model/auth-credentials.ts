import { useAuthStore } from '@/features/auth/model/auth-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { deriveCredentials } from '@/shared/crypto/derive-placeholder'

export async function registerUser(username: string, password: string) {
  const store = useAuthStore.getState()
  store.setLoading(true)

  try {
    const creds = await deriveCredentials(username, password)
    const result = await authAdapter.signup(username, creds.authHash, creds.keySalt)
    store.setAuth(result.user, result.session)
    return result
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
    store.reset()
  } finally {
    store.setLoading(false)
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
