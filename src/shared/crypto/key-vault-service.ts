import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { fetchMasterKeyEnvelope, fetchFieldKeys } from '@/shared/api/supabase-keys'
import { hexDecode, zeroFill } from '@/shared/crypto/crypto-utils'
import { decrypt, importKey } from '@/shared/crypto/aes-gcm'
import { keyVault } from '@/shared/crypto/key-vault'
import { unwrapFieldKeys } from '@/shared/crypto/key-hierarchy'
import { deriveKEK } from '@/shared/crypto/hkdf'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import { derivePasswordKey } from '@/shared/crypto/argon2id'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'

/**
 * Derives the KEK from a password and a master key envelope, unwraps field keys,
 * and stores them in the KeyVault as non-extractable CryptoKeys - making the vault operational.
 *
 * When a cached envelope is provided, skips the network round-trip and derives
 * directly from cache. Otherwise fetches a fresh envelope from the server and
 * caches it for future unlock attempts.
 */
export async function populateKeyVault(userId: string, password: string, cachedEnvelope?: CachedVaultEnvelope) {
  let envelope
  if (cachedEnvelope) {
    envelope = cachedEnvelope
  } else {
    envelope = await fetchFreshEnvelope(userId)
    useCryptoStore.getState().setCachedEnvelope(envelope)
  }
  const kek = await deriveKekFromEnvelope(password, envelope)
  const unwrappedFieldKeys = await unwrapFieldKeys(envelope.fieldKeys, kek)
  // Store KEK and field keys in the vault (non-extractable CryptoKeys)
  keyVault.storeFieldKeys(kek, unwrappedFieldKeys)
}

async function fetchFreshEnvelope(userId: string): Promise<CachedVaultEnvelope> {
  // Sequential: both calls require an active auth session;
  // parallel requests can race on session initialization
  const masterKeyEnvelope = await fetchMasterKeyEnvelope(userId)
  const serverFieldKeys = await fetchFieldKeys(userId)
  const freshEnvelope = { ...masterKeyEnvelope, fieldKeys: serverFieldKeys }
  return freshEnvelope
}

async function deriveKekFromEnvelope(password: string, envelope: CachedVaultEnvelope): Promise<CryptoKey> {
  // Derive password key
  const passwordKey = await derivePasswordKey(password, hexDecode(envelope.keySalt))
  const cryptoPasswordKey = await importKey(passwordKey)
  zeroFill(passwordKey)

  // Unwrap master key → derive KEK
  const wrappedMasterKey = hexDecode(envelope.wrappedMasterKey)
  const masterKey = await decrypt(wrappedMasterKey, cryptoPasswordKey, {
    iv: hexDecode(envelope.masterKeyIV),
    aad: MASTER_KEY_PASSWORD_AAD,
  })
  const kekBytes = await deriveKEK(masterKey)
  const kek = await importKey(kekBytes)
  zeroFill(kekBytes)
  zeroFill(masterKey)
  return kek
}
