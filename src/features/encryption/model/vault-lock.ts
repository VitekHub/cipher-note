/**
 * Vault lock and unlock operations.
 *
 * lockVault clears all keys from the crypto store and purges the TanStack Query cache.
 * unlockVault re-derives keys from the user's password and populates the crypto store.
 */

import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { deriveLoginKeys } from '@/features/encryption/model/login'
import { deriveLoginCredentials } from '@/shared/crypto/split-kdf'
import { getKeys, getFieldKeys } from '@/shared/api/supabase-keys'
import { hexDecode, hexEncode, encodeFieldKeysToHex } from '@/shared/crypto/memory'
import { exportKey } from '@/shared/crypto/aes-gcm'

/**
 * Lock the vault: zero all keys in the crypto store, set isVaultLocked = true,
 * and purge the TanStack Query cache for field data.
 */
export function lockVault(): void {
  useCryptoStore.getState().lockVault()
}

/**
 * Unlock the vault: re-derive keys from password and populate the crypto store.
 * The user must already be authenticated (auth store has a user).
 */
export async function unlockVault(password: string): Promise<void> {
  const user = useAuthStore.getState().user
  if (!user) {
    throw new Error('Cannot unlock vault: no authenticated user')
  }

  // Fetch key material (user is already authenticated)
  const [serverKeys, serverFieldKeys] = await Promise.all([getKeys(user.id), getFieldKeys(user.id)])

  // Derive authHash + passwordKey from password + salts
  const { passwordKey } = await deriveLoginCredentials(
    password,
    hexDecode(serverKeys.authSalt),
    hexDecode(serverKeys.keySalt),
  )

  // Unwrap all keys (master key, KEK, field keys)
  const loginResult = await deriveLoginKeys(
    passwordKey,
    hexDecode(serverKeys.wrappedMasterKey),
    hexDecode(serverKeys.masterKeyIV),
    serverFieldKeys,
  )

  // Hex-encode and store in crypto store
  const kekBytes = await exportKey(loginResult.kek)
  useCryptoStore
    .getState()
    .setKeys(hexEncode(loginResult.masterKey), hexEncode(kekBytes), encodeFieldKeysToHex(loginResult.fieldKeys))
}
