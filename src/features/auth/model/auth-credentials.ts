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
