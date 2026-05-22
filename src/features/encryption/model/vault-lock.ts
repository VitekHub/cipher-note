import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { deriveLoginKeys } from '@/features/encryption/model/login'
import { deriveLoginCredentials } from '@/shared/crypto/split-kdf'
import { getMasterKeyEnvelope, getFieldKeys } from '@/shared/api/supabase-keys'
import { hexDecode, hexEncode, encodeFieldKeysToHex } from '@/shared/crypto/memory'
import { exportKey } from '@/shared/crypto/aes-gcm'

/** Zero keys, set isVaultLocked, purge query cache. */
export function lockVault(): void {
  useCryptoStore.getState().lockVault()
}

/**
 * Unlock the vault: re-derive keys from password and populate the crypto store.
 * The user must already be authenticated.
 */
export async function unlockVault(password: string): Promise<void> {
  const user = useAuthStore.getState().user
  if (!user) {
    throw new Error('Cannot unlock vault: no authenticated user')
  }

  const [masterKeyEnvelope, serverFieldKeys] = await Promise.all([getMasterKeyEnvelope(user.id), getFieldKeys(user.id)])

  const { passwordKey } = await deriveLoginCredentials(
    password,
    hexDecode(masterKeyEnvelope.authSalt),
    hexDecode(masterKeyEnvelope.keySalt),
  )

  const { masterKey, kek, fieldKeys } = await deriveLoginKeys({
    passwordKey,
    wrappedMasterKey: hexDecode(masterKeyEnvelope.wrappedMasterKey),
    masterKeyIV: hexDecode(masterKeyEnvelope.masterKeyIV),
    serverFieldKeys,
  })

  const kekBytes = await exportKey(kek)
  useCryptoStore.getState().setKeys(hexEncode(masterKey), hexEncode(kekBytes), encodeFieldKeysToHex(fieldKeys))
}
