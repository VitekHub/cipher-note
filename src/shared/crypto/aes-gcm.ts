import { DecryptionError } from '@/shared/crypto/errors'

const IV_LENGTH = 12
const AES_GCM_ALGORITHM = 'AES-GCM'
const AES_GCM_KEY_LENGTH = 256

export function generateIV(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

export async function encrypt(
  plaintext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  iv?: Uint8Array<ArrayBuffer>,
): Promise<{ ciphertext: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer> }> {
  const usedIV = iv ?? generateIV()
  const algorithm = { name: AES_GCM_ALGORITHM, iv: usedIV }
  const buffer = await crypto.subtle.encrypt(algorithm, key, plaintext)
  return { ciphertext: new Uint8Array(buffer), iv: usedIV }
}

export async function decrypt(
  ciphertext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const algorithm = { name: AES_GCM_ALGORITHM, iv }
    const buffer = await crypto.subtle.decrypt(algorithm, key, ciphertext)
    return new Uint8Array(buffer)
  } catch (error) {
    throw new DecryptionError(undefined, { cause: error as Error })
  }
}

export async function importKey(rawKey: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  if (rawKey.length !== AES_GCM_KEY_LENGTH / 8) {
    throw new Error(`Invalid key length: expected ${AES_GCM_KEY_LENGTH / 8} bytes, got ${rawKey.length}`)
  }
  return crypto.subtle.importKey('raw', rawKey, { name: AES_GCM_ALGORITHM }, true, ['encrypt', 'decrypt'])
}

export async function exportKey(key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await crypto.subtle.exportKey('raw', key)
  return new Uint8Array(buffer)
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: AES_GCM_ALGORITHM, length: AES_GCM_KEY_LENGTH }, true, [
    'encrypt',
    'decrypt',
  ])
}
