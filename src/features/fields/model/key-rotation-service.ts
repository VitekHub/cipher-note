/**
 * Field-key rotation.
 *
 * Pulls inputs from the vault + cached envelope, runs the pure crypto rotation,
 * commits it via the atomic server RPC, then updates the local vault + cache.
 */

import { keyVault } from '@/shared/crypto/vault/key-vault'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { fetchAllEncryptedFieldsForUser } from '@/shared/api/supabase-fields'
import { rotateFieldKeyRpc } from '@/shared/api/supabase-keys'
import { markLocalKeyRotation } from '@/shared/realtime/realtime-echo'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'
import type { FieldName } from '@/shared/types/entities/field.types'
import { generateFieldKey } from '@/shared/crypto/keys/field-keys'
import { hexEncode, hexDecode } from '@/shared/crypto/core/crypto-utils'
import { encryptField, decryptField } from '@/features/fields/model/field-crypto'
import type { ServerEncryptedField } from '@/shared/types/api.types'

/** A field that rotated successfully. */
export type RotationSuccess = { fieldName: FieldName; ok: true; newVersion: number }

/** A field whose rotation failed — others are unaffected. */
export type RotationFailure = { fieldName: FieldName; ok: false; error: unknown }

export type RotationOutcome = RotationSuccess | RotationFailure

/** Next version number for a field key (current version + 1). */
function nextVersionFor(fieldName: FieldName): number {
  const envelope = useCryptoStore.getState().cachedEnvelope
  if (!envelope) throw new Error('No cached envelope — vault is locked')
  const key = envelope.fieldKeys.find((k) => k.fieldName === fieldName)
  if (!key) throw new Error(`No field key found for "${fieldName}"`)
  return key.version + 1
}

/** Re-encrypt all ciphertexts for a field from the old key to the new key. */
async function reEncryptCiphertexts(
  ciphertexts: ServerEncryptedField[],
  newFieldKey: CryptoKey,
  fieldName: FieldName,
): Promise<{ entryId: string; ciphertext: string; ciphertextIV: string }[]> {
  const oldFieldKey = keyVault.getKey(fieldName)
  if (!oldFieldKey) throw new Error('Vault is locked — cannot re-encrypt')

  return Promise.all(
    ciphertexts.map(async ({ entryId, ciphertext, ciphertextIV }) => {
      const plaintext = await decryptField(
        { ciphertext: hexDecode(ciphertext), ciphertextIV: hexDecode(ciphertextIV) },
        oldFieldKey,
        fieldName,
      )
      const newEncrypted = await encryptField(plaintext, newFieldKey, fieldName)
      return {
        entryId,
        ciphertext: hexEncode(newEncrypted.ciphertext),
        ciphertextIV: hexEncode(newEncrypted.ciphertextIV),
      }
    }),
  )
}

/**
 * Atomically rotate one field's key: re-encrypt every entry's ciphertext for
 * that field and swap the wrapped key server-side in a single transaction,
 * then update the local vault + cache.
 */
export async function rotateFieldKey(userId: string, fieldName: FieldName): Promise<number> {
  const kek = keyVault.getKey('kek')
  if (!kek || !keyVault.getKey(fieldName)) throw new Error('Vault is locked — cannot rotate')

  const currentCiphertexts = await fetchAllEncryptedFieldsForUser(userId, fieldName)

  // --- Pure crypto: generate, wrap, and re-encrypt ---
  const newVersion = nextVersionFor(fieldName)
  const { cryptoKey: newFieldKey, wrappedFieldKey, fieldKeyIV } = await generateFieldKey(kek, fieldName, newVersion)
  const reEncryptedFields = await reEncryptCiphertexts(currentCiphertexts, newFieldKey, fieldName)

  markLocalKeyRotation(fieldName, newVersion)

  // --- Server commit ---
  await rotateFieldKeyRpc({
    fieldName,
    newVersion,
    newWrappedFieldKey: hexEncode(wrappedFieldKey),
    newFieldKeyIV: hexEncode(fieldKeyIV),
    reEncryptedFields,
  })

  // Local state update only. Store the new key and update the cached envelope.
  keyVault.storeKey(fieldName, newFieldKey)
  useCryptoStore.getState().updateCachedFieldKey({
    fieldName,
    version: newVersion,
    wrappedFieldKey: hexEncode(wrappedFieldKey),
    fieldKeyIV: hexEncode(fieldKeyIV),
  })

  return newVersion
}

/**
 * Rotate all four field keys sequentially. Each field is an independent atomic
 * RPC, so partial success is expected and surfaced per field: a failure on the
 * 3rd field leaves the first two rotated and the 4th untouched. Failed fields
 * can be retried independently.
 */
export async function rotateAllFields(userId: string): Promise<RotationOutcome[]> {
  const outcomes: RotationOutcome[] = []
  for (const fieldName of FIELD_NAMES) {
    try {
      const newVersion = await rotateFieldKey(userId, fieldName)
      outcomes.push({ fieldName, ok: true, newVersion })
    } catch (error) {
      outcomes.push({ fieldName, ok: false, error })
    }
  }
  return outcomes
}
