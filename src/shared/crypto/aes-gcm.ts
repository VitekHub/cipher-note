import { DecryptionError } from '@/shared/crypto/errors'
import { copyToUint8Array } from '@/shared/crypto/crypto-utils'
import { CRYPTO_KEY_LENGTH } from '@/shared/types/crypto.types'
import type { AesGcmOptions } from '@/shared/types/crypto.types'

const AES_GCM_ALGORITHM = 'AES-GCM'

export async function encrypt(
  plaintext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  { iv, aad }: AesGcmOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const algorithm: AesGcmParams = { name: AES_GCM_ALGORITHM, iv, additionalData: aad }
  const buffer = await crypto.subtle.encrypt(algorithm, key, plaintext)
  return copyToUint8Array(buffer)
}

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
