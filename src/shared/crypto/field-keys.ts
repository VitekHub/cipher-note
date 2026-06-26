/**
 * Field key operations: generation, wrapping, and unwrapping.
 *
 * Each entry has four encrypted fields (title, note, website, email), each
 * protected by its own 256-bit field key. Field keys are wrapped (encrypted)
 * with the KEK and AAD(fieldName, version) for server storage, and unwrapped
 * during vault unlock.
 */

import { importKey } from '@/shared/crypto/aes-gcm'
import { generateKey, generateIV, encodeAAD, hexDecode, zeroFill } from '@/shared/crypto/crypto-utils'
import { encrypt, decrypt } from '@/shared/crypto/aes-gcm'
import type { WrappedFieldKey } from '@/shared/types/crypto.types'
import { FIELD_KEY_VERSION } from '@/shared/types/crypto.types'
import type { ServerFieldKey } from '@/shared/types/api.types'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'

/**
 * Generate all four field keys, import them as CryptoKeys, and wrap them
 * with the KEK — all in a single parallel pass.
 *
 * This combines what were previously three separate steps (generate → version
 * → wrap) into one, avoiding multiple iterations over the field key arrays.
 * Raw keys are zero-filled after wrapping.
 */
export async function generateAndWrapFieldKeys(
  kek: CryptoKey,
): Promise<{ cryptoFieldKeys: Map<string, CryptoKey>; wrappedFieldKeys: WrappedFieldKey[] }> {
  const cryptoFieldKeys = new Map<string, CryptoKey>()
  const wrappedFieldKeys: WrappedFieldKey[] = []

  await Promise.all(
    FIELD_NAMES.map(async (fieldName) => {
      const rawKey = generateKey()
      try {
        const cryptoKey = await importKey(rawKey)
        const fieldKeyIV = generateIV()
        const aad = encodeAAD(fieldName, FIELD_KEY_VERSION)
        const wrappedFieldKey = await encrypt(rawKey, kek, { iv: fieldKeyIV, aad })

        cryptoFieldKeys.set(fieldName, cryptoKey)
        wrappedFieldKeys.push({ fieldName, version: FIELD_KEY_VERSION, wrappedFieldKey, fieldKeyIV })
      } finally {
        zeroFill(rawKey)
      }
    }),
  )

  return { cryptoFieldKeys, wrappedFieldKeys }
}

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
      const fieldKeyIV = generateIV()
      const wrappedFieldKey = await encrypt(key, kek, { iv: fieldKeyIV, aad })

      return { fieldName, version, wrappedFieldKey, fieldKeyIV } as WrappedFieldKey
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
    fieldKeys.map(async ({ fieldName, version, wrappedFieldKey, fieldKeyIV }) => {
      const aad = encodeAAD(fieldName, version)
      const iv = hexDecode(fieldKeyIV)
      const unwrappedKey = await decrypt(hexDecode(wrappedFieldKey), kek, { iv, aad })
      const key = await importKey(unwrappedKey)
      return [fieldName, key] as [string, CryptoKey]
    }),
  )

  return new Map<string, CryptoKey>(entries)
}
