/**
 * Atomic field-key rotation: pure crypto.
 *
 * Derives the next field-key version, wraps the new key with the KEK, and
 * re-encrypts every entry's ciphertext for that field from the old field key
 * to the new one. Pure — no network, no store, no side effects beyond crypto
 * state.
 */

import { encrypt, decrypt, importKey } from '@/shared/crypto/core/aes-gcm'
import { generateKey, generateIV, encodeAAD, hexEncode, hexDecode, zeroFill } from '@/shared/crypto/core/crypto-utils'
import { FIELD_KEY_VERSION } from '@/shared/types/crypto.types'

export type ReEncryptedFieldResult = {
  entryId: string
  ciphertext: string // hex
  ciphertextIv: string // hex
}

export type RotationResult = {
  newCryptoKey: CryptoKey
  newVersion: number
  newWrappedFieldKey: string // hex
  newFieldKeyIv: string // hex
  reEncryptedFields: ReEncryptedFieldResult[]
}

export type RotateFieldKeyCryptoInput = {
  kek: CryptoKey
  oldFieldKey: CryptoKey
  fieldName: string
  currentVersion: number
  currentCiphertexts: { entryId: string; ciphertext: string; ciphertextIv: string }[]
}

/**
 * Derive the next field-key version and re-encrypt every ciphertext with a
 * freshly generated field key.
 *
 * Two distinct AADs are used:
 * - Wrap AAD: `encodeAAD(fieldName, newVersion)` — binds the wrapped key to its
 *   version, matching `field-keys.ts` so the new key unwraps correctly.
 * - Content AAD: `encodeAAD(fieldName, FIELD_KEY_VERSION)` — the constant
 *   scheme version, matching `field-crypto.ts`. The same AAD is used for the
 *   old decrypt and the new encrypt; it does NOT track the rotation version.
 */
export async function rotateFieldKeyCrypto(input: RotateFieldKeyCryptoInput): Promise<RotationResult> {
  const { kek, oldFieldKey, fieldName, currentVersion, currentCiphertexts } = input
  const newVersion = currentVersion + 1
  const rawNewKey = generateKey()
  try {
    const newCryptoKey = await importKey(rawNewKey)

    // Wrap the new field key with the KEK. AAD binds the wrap to newVersion.
    const fieldKeyIv = generateIV()
    const wrapAad = encodeAAD(fieldName, newVersion)
    const wrappedFieldKey = await encrypt(rawNewKey, kek, { iv: fieldKeyIv, aad: wrapAad })

    // Content encryption uses the constant FIELD_KEY_VERSION AAD (not newVersion).
    const contentAad = encodeAAD(fieldName, FIELD_KEY_VERSION)

    const reEncryptedFields = await Promise.all(
      currentCiphertexts.map(async ({ entryId, ciphertext, ciphertextIv }) => {
        const plaintext = await decrypt(hexDecode(ciphertext), oldFieldKey, {
          iv: hexDecode(ciphertextIv),
          aad: contentAad,
        })
        const newIv = generateIV()
        const newCipher = await encrypt(plaintext, newCryptoKey, { iv: newIv, aad: contentAad })
        return {
          entryId,
          ciphertext: hexEncode(newCipher),
          ciphertextIv: hexEncode(newIv),
        }
      }),
    )

    return {
      newCryptoKey,
      newVersion,
      newWrappedFieldKey: hexEncode(wrappedFieldKey),
      newFieldKeyIv: hexEncode(fieldKeyIv),
      reEncryptedFields,
    }
  } finally {
    zeroFill(rawNewKey)
  }
}
