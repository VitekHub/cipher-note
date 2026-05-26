import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { deriveLoginKeys } from '@/features/encryption/model/login'
import { deriveLoginCredentials } from '@/shared/crypto/split-kdf'
import { getMasterKeyEnvelope, getFieldKeys } from '@/shared/api/supabase-keys'
import { hexDecode, hexEncode, encodeFieldKeysToHex } from '@/shared/crypto/crypto-utils'
import { exportKey } from '@/shared/crypto/aes-gcm'
import { DecryptionError } from '@/shared/crypto/errors'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'

/** Zero keys, set isVaultLocked, purge query cache. Preserves cached envelope. */
export function lockVault(): void {
  useCryptoStore.getState().lockVault()
}

/** Zero all state including cached envelope. Used on logout. */
export function clearVault(): void {
  useCryptoStore.getState().clearVault()
}

/**
 * Unlock the vault: re-derive keys from password and populate the crypto store.
 * Uses cached envelope when available (skips network calls).
 * On decryption failure with cached envelope, clears cache and retries from server.
 */
export async function unlockVault(password: string): Promise<void> {
  const user = useAuthStore.getState().user
  if (!user) {
    throw new Error('Cannot unlock vault: no authenticated user')
  }

  let staleCache = false
  const cachedEnvelope = useCryptoStore.getState().cachedEnvelope
  if (cachedEnvelope) {
    try {
      await unlockWithEnvelope(password, cachedEnvelope)
    } catch (error) {
      if (error instanceof DecryptionError) {
        // Cached envelope may be stale (password changed in another session).
        // Clear the stale cache and retry the full network + derivation path.
        useCryptoStore.getState().clearVault()
        staleCache = true
      } else {
        throw error
      }
    }
  }

  if (!cachedEnvelope || staleCache) {
    // Sequential: both calls require an active auth session;
    // parallel requests can race on session initialization
    const masterKeyEnvelope = await getMasterKeyEnvelope(user.id)
    const serverFieldKeys = await getFieldKeys(user.id)
    const freshEnvelope = { ...masterKeyEnvelope, fieldKeys: serverFieldKeys }
    useCryptoStore.getState().setCachedEnvelope(freshEnvelope)
    await unlockWithEnvelope(password, freshEnvelope)
  }
}

async function unlockWithEnvelope(password: string, envelope: CachedVaultEnvelope): Promise<void> {
  const { passwordKey } = await deriveLoginCredentials(
    password,
    hexDecode(envelope.authSalt),
    hexDecode(envelope.keySalt),
  )

  const { masterKey, kek, fieldKeys } = await deriveLoginKeys({
    passwordKey,
    wrappedMasterKey: hexDecode(envelope.wrappedMasterKey),
    masterKeyIV: hexDecode(envelope.masterKeyIV),
    serverFieldKeys: envelope.fieldKeys,
  })

  const kekBytes = await exportKey(kek)
  useCryptoStore.getState().setKeys(hexEncode(masterKey), hexEncode(kekBytes), encodeFieldKeysToHex(fieldKeys))
}
