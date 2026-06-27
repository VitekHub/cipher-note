/**
 * Field key operations: generation+wrapping and unwrapping.
 *
 * Each entry has four encrypted fields (title, note, website, email), each
 * protected by its own 256-bit field key. `generateAndWrapFieldKeys` creates
 * and wraps all four field keys in a single parallel pass; `unwrapFieldKeys`
 * decrypts them during vault unlock.
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
