/**
 * Derives sub-keys from a master key using HKDF (HMAC-based Key Derivation
 * Function). Each sub-key is uniquely bound to its purpose via the `info`
 * parameter, so the same master key produces different keys for different uses.
 *
 * Typical usage:
 * - `"wrap"` info → KEK (Key Encryption Key) used to wrap/unwrap field keys
 * - `"sign"` info → signing key seed for integrity verification of wrapped keys
 */

const HKDF_HASH = 'SHA-256'
const DEFAULT_LENGTH = 32

const encoder = new TextEncoder()

/**
 * Derive a sub-key from a master key using HKDF-SHA-256.
 *
 * Each `info` parameter produces a cryptographically independent sub-key, so
 * the same master key can safely derive both the KEK and the signing key seed
 * with zero overlap.
 *
 * @param masterKey - 32-byte random master key
 * @param info - Purpose string (e.g. `"wrap"` for KEK, `"sign"` for signing key seed)
 * @param length - Output length in bytes (default 32 = 256 bits)
 * @returns Derived sub-key as raw bytes
 */
export async function deriveSubKey(
  masterKey: Uint8Array<ArrayBuffer>,
  info: string,
  length: number = DEFAULT_LENGTH,
): Promise<Uint8Array<ArrayBuffer>> {
  const baseKey = await crypto.subtle.importKey('raw', masterKey, { name: 'HKDF', hash: HKDF_HASH }, false, [
    'deriveBits',
  ])

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: HKDF_HASH,
      // empty salt because the master key is already a strong random value
      salt: new Uint8Array(0),
      info: encoder.encode(info),
    },
    baseKey,
    length * 8,
  )

  return new Uint8Array(derivedBits)
}

/**
 * Derive the Key Encryption Key (KEK) from a master key.
 * The KEK is used to wrap and unwrap field keys.
 */
export async function deriveKEK(masterKey: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return deriveSubKey(masterKey, 'wrap')
}

/**
 * Derive the signing key seed from a master key.
 */
export async function deriveSigningKeySeed(masterKey: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return deriveSubKey(masterKey, 'sign')
}
