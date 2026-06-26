import { DecryptionError } from '@/shared/crypto/core/errors'
import { copyToUint8Array } from '@/shared/crypto/core/crypto-utils'
import { CRYPTO_KEY_LENGTH } from '@/shared/types/crypto.types'
import type { AesGcmOptions } from '@/shared/types/crypto.types'

const AES_GCM_ALGORITHM = 'AES-GCM'

/** Encrypt plaintext using AES-256-GCM. Returns ciphertext with the IV/AAD bound to the key. */
export async function encrypt(
  plaintext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  { iv, aad }: AesGcmOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const algorithm: AesGcmParams = { name: AES_GCM_ALGORITHM, iv, additionalData: aad }
  const buffer = await crypto.subtle.encrypt(algorithm, key, plaintext)
  return copyToUint8Array(buffer)
}

/** Decrypt AES-256-GCM ciphertext. Throws DecryptionError on wrong key or tampered data. */
export async function decrypt(
  ciphertext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  { iv, aad }: AesGcmOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const algorithm: AesGcmParams = { name: AES_GCM_ALGORITHM, iv, additionalData: aad }
    const buffer = await crypto.subtle.decrypt(algorithm, key, ciphertext)
    return copyToUint8Array(buffer)
  } catch (error) {
    throw new DecryptionError(undefined, { cause: error as Error })
  }
}

export async function importKey(rawKey: Uint8Array<ArrayBuffer>, extractable = false): Promise<CryptoKey> {
  if (rawKey.length !== CRYPTO_KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${CRYPTO_KEY_LENGTH} bytes, got ${rawKey.length}`)
  }
  return crypto.subtle.importKey('raw', rawKey, { name: AES_GCM_ALGORITHM }, extractable, ['encrypt', 'decrypt'])
}

export async function exportKey(key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await crypto.subtle.exportKey('raw', key)
  return copyToUint8Array(buffer)
}
