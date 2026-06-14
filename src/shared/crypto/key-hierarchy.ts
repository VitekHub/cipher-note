/**
 * This module ties together the lower-level crypto primitives (HKDF, AES-GCM,
 * key wrapping) into the operations needed for registration, login, and vault
 * management:
 *
 *   Master Key (random 256 bits)
 *     ├── KEK (HKDF info="wrap")  → wraps/unwraps field keys
 *     └── Signing Key Seed (HKDF info="sign")  → integrity verification of wrapped keys
 *
 *   Field Keys (random 256 bits each, per field: title, note, website, email)
 *     → wrapped with KEK + AAD(fieldName, version) for server storage
 *
 * Flow at registration:
 *   generate master key → derive KEK → generate a field key for each field → wrap them with KEK → upload wrapped keys + salts + IVs
 *
 * Flow at login:
 *   password key → unwrap master key → derive KEK → unwrap field keys → unlock vault
 */

import { importKey } from '@/shared/crypto/aes-gcm'
import { generateKey, generateIV, encodeAAD, hexDecode } from '@/shared/crypto/crypto-utils'
import { encrypt, decrypt } from '@/shared/crypto/aes-gcm'
import { deriveKEK, deriveSigningKeySeed } from '@/shared/crypto/hkdf'
import type { KeyHierarchy, WrappedFieldKey } from '@/shared/types/crypto.types'
import type { ServerFieldKey } from '../types/api.types'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'

/**
 * Generate all four field keys (title, note, website, email) at once.
 * Each is a 256-bit random key. Returns both the raw key bytes (for wrapping)
 * and imported CryptoKeys (for encryption).
 */
export async function generateFieldKeys(): Promise<{
  rawFieldKeys: Map<string, Uint8Array<ArrayBuffer>>
  cryptoFieldKeys: Map<string, CryptoKey>
}> {
  const entries = FIELD_NAMES.map((name) => [name, generateKey()] as [string, Uint8Array<ArrayBuffer>])
  const cryptoFieldKeys = new Map(
    await Promise.all(entries.map(async ([name, key]) => [name, await importKey(key)] as const)),
  )
  return { rawFieldKeys: new Map(entries), cryptoFieldKeys }
}

/** Generate a 256-bit random master key. Used once during registration. */
export function generateMasterKey(): Uint8Array<ArrayBuffer> {
  return generateKey()
}

/**
 * Derive the full key hierarchy from a master key.
 *
 * Derives KEK (for wrapping field keys) and signing key seed (for integrity
 * verification) from the master key using HKDF. Imports the KEK bytes as an
 * AES-GCM CryptoKey for direct use in key wrapping operations.
 *
 * @param masterKey - 256-bit random master key
 * @returns KeyHierarchy containing master key, KEK (CryptoKey), and signing key seed
 */
export async function deriveFullKeyHierarchy(masterKey: Uint8Array<ArrayBuffer>): Promise<KeyHierarchy> {
  const [kekBytes, signingKeySeed] = await Promise.all([deriveKEK(masterKey), deriveSigningKeySeed(masterKey)])

  const kek = await importKey(kekBytes, false)

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
  return await Promise.all(
    Array.from(fieldKeys.entries()).map(async ([fieldName, key]) => {
      const version = versions.get(fieldName)
      if (version === undefined) {
        throw new Error(`Missing version for field "${fieldName}"`)
      }

      const aad = encodeAAD(fieldName, version)
      const iv = generateIV()
      const wrappedKey = await encrypt(key, kek, { iv, aad })

      return { fieldName, version, wrappedKey, iv } as WrappedFieldKey
    }),
  )
}

/**
 * Unwrap multiple field keys with the KEK.
 *
 * Decrypts each wrapped field key using AES-256-GCM with AAD (field name + version).
 * The AAD is verified during decryption, so any version mismatch or data tampering
 * will cause a DecryptionError. Returns imported CryptoKeys ready for encryption.
 *
 * @param fieldKeys - Wrapped field keys fetched from server
 * @param kek - Key Encryption Key (CryptoKey) to unwrap with
 * @returns Map of field name → decrypted field key as CryptoKey
 */
export async function unwrapFieldKeys(fieldKeys: ServerFieldKey[], kek: CryptoKey): Promise<Map<string, CryptoKey>> {
  const entries = await Promise.all(
    fieldKeys.map(async ({ fieldName, version, wrappedKey, keyIV }) => {
      const aad = encodeAAD(fieldName, version)
      const iv = hexDecode(keyIV)
      const unwrappedKey = await decrypt(hexDecode(wrappedKey), kek, { iv, aad })
      const key = await importKey(unwrappedKey)
      return [fieldName, key] as [string, CryptoKey]
    }),
  )

  return new Map<string, CryptoKey>(entries)
}
