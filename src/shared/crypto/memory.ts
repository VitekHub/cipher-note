/**
 * Hex encoding/decoding and memory utilities for crypto key management.
 *
 * Crypto modules produce Uint8Array values, but Zustand stores and server API
 * types use hex-encoded strings. These functions bridge the two representations.
 */

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

/** Overwrite a Uint8Array with zeros. Best-effort memory clearing for key material. */
export function zeroFill(buffer: Uint8Array): void {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = 0
  }
}
