import { useCryptoStore, hasCachedEnvelope } from '@/features/encryption/model/crypto-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { deriveLoginKeys } from '@/features/encryption/model/login'
import { deriveLoginCredentials } from '@/shared/crypto/split-kdf'
import { getMasterKeyEnvelope, getFieldKeys } from '@/shared/api/supabase-keys'
import { hexDecode, hexEncode, encodeFieldKeysToHex } from '@/shared/crypto/memory'
import { exportKey } from '@/shared/crypto/aes-gcm'
import { DecryptionError } from '@/shared/crypto/errors'
import type { ServerFieldKey, ServerMasterKeyEnvelope } from '@/shared/types/api.types'

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

  const state = useCryptoStore.getState()
  let masterKeyEnvelope: ServerMasterKeyEnvelope
  let serverFieldKeys: ServerFieldKey[]
  const usedCache = hasCachedEnvelope(state)

  if (usedCache) {
    masterKeyEnvelope = state.cachedEnvelope!
    serverFieldKeys = state.cachedEnvelope!.fieldKeys
  } else {
    ;[masterKeyEnvelope, serverFieldKeys] = await Promise.all([getMasterKeyEnvelope(user.id), getFieldKeys(user.id)])
    useCryptoStore.getState().setCachedEnvelope({ ...masterKeyEnvelope, fieldKeys: serverFieldKeys })
  }

  try {
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
  } catch (error) {
    if (usedCache && error instanceof DecryptionError) {
      // Cached envelope may be stale (password changed in another session).
      // Clear the stale cache and retry the full network + derivation path.
      useCryptoStore.getState().clearVault()
      return unlockVaultFromServer(password, user.id)
    }
    throw error
  }
}

/**
 * Full unlock path: fetches envelope from server, caches it, derives keys.
 * Used as a retry after stale-cache decryption failure.
 */
async function unlockVaultFromServer(password: string, userId: string): Promise<void> {
  const [masterKeyEnvelope, serverFieldKeys] = await Promise.all([getMasterKeyEnvelope(userId), getFieldKeys(userId)])

  useCryptoStore.getState().setCachedEnvelope({ ...masterKeyEnvelope, fieldKeys: serverFieldKeys })

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
