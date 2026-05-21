import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import type { AuthResult } from '@/shared/auth/auth.types'
import { hexEncode } from '@/shared/crypto/memory'

export async function handleRegister(username: string, password: string): Promise<AuthResult & { mnemonic: string }> {
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
    useCryptoStore
      .getState()
      .setKeys(
        hexEncode(regResult.masterKey),
        hexEncode(regResult.kek),
        Object.fromEntries(Array.from(regResult.fieldKeys.entries()).map(([name, key]) => [name, hexEncode(key)])),
      )

    return { ...authResult, mnemonic: regResult.mnemonic }
  } finally {
    authStore.setLoading(false)
  }
}
