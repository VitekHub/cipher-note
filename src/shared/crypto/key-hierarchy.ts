/**
 * This module ties together the lower-level crypto primitives (HKDF, AES-GCM,
 * key wrapping) into the operations needed for registration, login, and vault
 * management:
 *
 *   Master Key (random 256 bits)
 *     ├── KEK (HKDF info="wrap")  → wraps/unwraps field keys
 *     └── Signing Key Seed (HKDF info="sign")  → integrity verification of wrapped keys
 *
 *   Field Keys (random 256 bits each, per field: note, website, email)
 *     → wrapped with KEK + AAD(fieldName, version) for server storage
 *
 * Flow at registration:
 *   generate master key → derive KEK → generate a field key for each field → wrap them with KEK → upload wrapped keys + salts + IVs
 *
 * Flow at login:
 *   password key → unwrap master key → derive KEK → unwrap field keys → unlock vault
 */

import { importKey } from '@/shared/crypto/aes-gcm'
import { encodeAAD, wrapKey, unwrapKey } from '@/shared/crypto/key-wrap'
import { deriveKEK, deriveSigningKeySeed } from '@/shared/crypto/hkdf'
import type { KeyHierarchy, WrappedFieldKey } from '@/shared/types/crypto.types'

/** Generate a 256-bit random master key. Used once during registration. */
export function generateMasterKey(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32))
}

/** Generate a 256-bit random field key. One per field (note, website, email). */
export function generateFieldKey(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32))
}

/**
 * Derive the full key hierarchy from a master key.
 *
 * Runs KEK and signing key seed derivation in parallel, then imports the KEK
 * bytes as an AES-GCM CryptoKey so it can be used directly for wrapping.
 *
 * @returns The master key, KEK (as CryptoKey), and signing key seed
 */
export async function deriveFullKeyHierarchy(masterKey: Uint8Array<ArrayBuffer>): Promise<KeyHierarchy> {
  const [kekBytes, signingKeySeed] = await Promise.all([deriveKEK(masterKey), deriveSigningKeySeed(masterKey)])

  const kek = await importKey(kekBytes)

  return { masterKey, kek, signingKeySeed }
}

/**
 * Wrap multiple field keys with the KEK for server storage.
 *
 * Each field key is encrypted with AES-256-GCM using AAD that binds the
 * ciphertext to the field name and version. This provides rollback protection:
 * unwrapping with a wrong version will fail.
 *
 * @param fieldKeys - Map of field name → plaintext field key
 * @param kek - Key Encryption Key (CryptoKey) to wrap with
 * @param versions - Map of field name → key version number. Every field key
 *   must have a corresponding version, otherwise this throws.
 * @returns Array of wrapped field keys ready for server upload
 */
export async function wrapFieldKeys(
  fieldKeys: Map<string, Uint8Array<ArrayBuffer>>,
  kek: CryptoKey,
  versions: Map<string, number>,
): Promise<WrappedFieldKey[]> {
  const results: WrappedFieldKey[] = []

  for (const [fieldName, key] of fieldKeys) {
    const version = versions.get(fieldName)
    if (version === undefined) {
      throw new Error(`Missing version for field "${fieldName}"`)
    }

    const aad = encodeAAD(fieldName, version)
    const { wrappedKey, iv } = await wrapKey(key, kek, aad)

    results.push({ fieldName, version, wrappedKey, iv })
  }

  return results
}

/**
 * Unwrap multiple field keys with the KEK.
 *
 * Verifies the AAD (field name + version) for each key, so any version
 * mismatch or data tampering will cause a DecryptionError.
 *
 * @param wrappedKeys - Wrapped field keys fetched from server
 * @param kek - Key Encryption Key (CryptoKey) to unwrap with
 * @returns Map of field name → plaintext field key
 */
export async function unwrapFieldKeys(
  wrappedKeys: WrappedFieldKey[],
  kek: CryptoKey,
): Promise<Map<string, Uint8Array<ArrayBuffer>>> {
  const result = new Map<string, Uint8Array<ArrayBuffer>>()

  for (const { fieldName, version, wrappedKey, iv } of wrappedKeys) {
    const aad = encodeAAD(fieldName, version)
    const key = await unwrapKey(wrappedKey, kek, iv, aad)
    result.set(fieldName, key)
  }

  return result
}
