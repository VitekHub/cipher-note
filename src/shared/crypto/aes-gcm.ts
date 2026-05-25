import { DecryptionError } from '@/shared/crypto/errors'
import { copyToUint8Array } from '@/shared/crypto/memory'
import { CRYPTO_KEY_LENGTH } from '@/shared/types/crypto.types'

const IV_LENGTH = 12
const AES_GCM_ALGORITHM = 'AES-GCM'
const AES_GCM_KEY_LENGTH = CRYPTO_KEY_LENGTH * 8 // 256

export function generateIV(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

export async function encrypt(
  plaintext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  iv?: Uint8Array<ArrayBuffer>,
  aad?: Uint8Array<ArrayBuffer>,
): Promise<{ ciphertext: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer> }> {
  const usedIV = iv ?? generateIV()
  const algorithm: AesGcmParams = { name: AES_GCM_ALGORITHM, iv: usedIV }
  if (aad) algorithm.additionalData = aad
  const buffer = await crypto.subtle.encrypt(algorithm, key, plaintext)
  return { ciphertext: copyToUint8Array(buffer), iv: usedIV }
}

export async function decrypt(
  ciphertext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
  aad?: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const algorithm: AesGcmParams = { name: AES_GCM_ALGORITHM, iv }
    if (aad) algorithm.additionalData = aad
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

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: AES_GCM_ALGORITHM, length: AES_GCM_KEY_LENGTH }, true, [
    'encrypt',
    'decrypt',
  ])
}
