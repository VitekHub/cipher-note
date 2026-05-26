/**
 * Hex encoding/decoding, random byte generation, and memory utilities for crypto key management.
 *
 * Crypto modules produce Uint8Array values, but Zustand stores and server API
 * types use hex-encoded strings. These functions bridge the two representations.
 */

import { CRYPTO_KEY_LENGTH, CRYPTO_SALT_LENGTH, CRYPTO_IV_LENGTH } from '@/shared/types/crypto.types'

const encoder = new TextEncoder()

const MAX_FIELD_NAME_BYTES = 255

export function encodeAAD(fieldName: string, version: number): Uint8Array<ArrayBuffer> {
  if (version < 0) throw new Error(`Version must be non-negative, got ${version}`)
  const nameBytes = encoder.encode(fieldName)
  if (nameBytes.length > MAX_FIELD_NAME_BYTES) {
    throw new Error(`Field name too long: ${nameBytes.length} bytes (max ${MAX_FIELD_NAME_BYTES})`)
  }
  const result = new Uint8Array(2 + nameBytes.length + 4)
  const view = new DataView(result.buffer)
  view.setUint16(0, nameBytes.length, false)
  result.set(nameBytes, 2)
  view.setUint32(2 + nameBytes.length, version, false)
  return result
}

/** Generate `length` cryptographically random bytes as Uint8Array<ArrayBuffer>. */
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length)) as Uint8Array<ArrayBuffer>
}

/** Generate a random 12-byte IV for AES-GCM. */
export function generateIV(): Uint8Array<ArrayBuffer> {
  return randomBytes(CRYPTO_IV_LENGTH)
}

/** Generate a random 16-byte salt for Argon2id key derivation. */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  return randomBytes(CRYPTO_SALT_LENGTH)
}

/** Generate a random 32-byte key for AES-256. */
export function generateKey(): Uint8Array<ArrayBuffer> {
  return randomBytes(CRYPTO_KEY_LENGTH)
}

/** Convert a Uint8Array to a lowercase hex string. */
export function hexEncode(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Convert a hex string to a Uint8Array. Throws on odd-length or non-hex input. */
export function hexDecode(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) {
    throw new Error(`hexDecode: odd-length input (${hex.length} chars)`)
  }

  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16)
    if (Number.isNaN(byte)) {
      throw new Error(`hexDecode: non-hex character at position ${i}`)
    }
    bytes[i / 2] = byte
  }

  return bytes as Uint8Array<ArrayBuffer>
}

/** Convert a Map of field keys to a hex-encoded Record (for Zustand store). */
export function encodeFieldKeysToHex(fieldKeys: Map<string, Uint8Array>): Record<string, string> {
  return Object.fromEntries(Array.from(fieldKeys.entries()).map(([name, key]) => [name, hexEncode(key)]))
}

/** Create an independent copy of ArrayBuffer or Uint8Array data as Uint8Array<ArrayBuffer>.
 *  Always copies - never creates a view sharing the original buffer. Use when storing
 *  Web Crypto results before hex-encoding, since those ArrayBuffers can be neutered. */
export function copyToUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data)
  return new Uint8Array(view) as Uint8Array<ArrayBuffer>
}

/** Overwrite a Uint8Array with zeros. Best-effort memory clearing for key material. */
export function zeroFill(buffer: Uint8Array): void {
  buffer.fill(0)
}
