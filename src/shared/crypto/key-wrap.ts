import { encrypt, decrypt, generateIV } from '@/shared/crypto/aes-gcm'
import type { WrappedKey } from '@/shared/types/crypto.types'

const encoder = new TextEncoder()

export function encodeAAD(fieldName: string, version: number): Uint8Array<ArrayBuffer> {
  const nameBytes = encoder.encode(fieldName)
  const result = new Uint8Array(2 + nameBytes.length + 4)
  const view = new DataView(result.buffer)
  view.setUint16(0, nameBytes.length, false)
  result.set(nameBytes, 2)
  view.setUint32(2 + nameBytes.length, version, false)
  return result
}

export async function wrapKey(
  plaintextKey: Uint8Array<ArrayBuffer>,
  wrappingKey: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
): Promise<WrappedKey> {
  const iv = generateIV()
  const { ciphertext } = await encrypt(plaintextKey, wrappingKey, iv, aad)
  return { wrappedKey: ciphertext, iv }
}

export async function unwrapKey(
  wrappedKey: Uint8Array<ArrayBuffer>,
  wrappingKey: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
  aad: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  return decrypt(wrappedKey, wrappingKey, iv, aad)
}
