import { decrypt, encrypt } from '@/shared/crypto/core/aes-gcm'
import { encodeAAD, generateIV, hexDecode, hexEncode } from '@/shared/crypto/core/crypto-utils'
import { FIELD_CONTENT_VERSION } from '@/shared/types/crypto.types'
import type { EncryptedFieldData } from '@/shared/types/crypto.types'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { SaveFieldData, ServerEncryptedField } from '@/shared/types/api.types'

/**
 * Encrypt a plaintext field value using AES-256-GCM with the field's CryptoKey.
 *
 * AAD binds the ciphertext to the field name and content version, preventing ciphertext
 * swapping between fields. A fresh random IV is generated each call.
 */
export async function encryptField(
  plaintext: string,
  fieldKey: CryptoKey,
  fieldName: FieldName,
): Promise<EncryptedFieldData> {
  const plaintextBytes = new TextEncoder().encode(plaintext) as Uint8Array<ArrayBuffer>
  const ciphertextIV = generateIV()
  const aad = encodeAAD(fieldName, FIELD_CONTENT_VERSION)
  const ciphertext = await encrypt(plaintextBytes, fieldKey, { iv: ciphertextIV, aad })
  return { ciphertext, ciphertextIV }
}

/**
 * Decrypt an encrypted field value back to a plaintext string.
 *
 * The AAD is reconstructed from fieldName + FIELD_CONTENT_VERSION, so the caller
 * must pass the same field name used during encryption.
 */
export async function decryptField(
  encryptedData: EncryptedFieldData,
  fieldKey: CryptoKey,
  fieldName: FieldName,
): Promise<string> {
  const aad = encodeAAD(fieldName, FIELD_CONTENT_VERSION)
  const plaintextBytes = await decrypt(encryptedData.ciphertext, fieldKey, { iv: encryptedData.ciphertextIV, aad })
  return new TextDecoder().decode(plaintextBytes)
}

/** Convert internal binary EncryptedFieldData to hex-string SaveFieldData for the API. */
export function toSaveFieldData(
  encryptedData: EncryptedFieldData,
  entryId: string,
  fieldName: FieldName,
): SaveFieldData {
  return {
    ciphertext: hexEncode(encryptedData.ciphertext),
    ciphertextIV: hexEncode(encryptedData.ciphertextIV),
    entryId,
    fieldName,
  }
}

/** Convert hex-string ServerEncryptedField from the API to binary EncryptedFieldData. */
export function toEncryptedFieldData(serverField: ServerEncryptedField): EncryptedFieldData {
  return {
    ciphertext: hexDecode(serverField.ciphertext),
    ciphertextIV: hexDecode(serverField.ciphertextIV),
  }
}
