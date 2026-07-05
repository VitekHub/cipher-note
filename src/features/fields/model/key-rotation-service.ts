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
import { rotateFieldKeyCrypto } from '@/shared/crypto/keys/key-rotation'
import { markLocalKeyRotation } from '@/shared/realtime/realtime-echo'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'
import type { FieldName } from '@/shared/types/entities/field.types'

/** A field that rotated successfully. */
export type RotationSuccess = { fieldName: FieldName; ok: true; newVersion: number }

/** A field whose rotation failed — others are unaffected. */
export type RotationFailure = { fieldName: FieldName; ok: false; error: unknown }

export type RotationOutcome = RotationSuccess | RotationFailure

/**
 * Highest wrapped-key version currently stored for a field, from the cached
 * envelope. After an atomic swap there is exactly one version per field.
 */
function maxVersionForField(fieldName: FieldName): number {
  const envelope = useCryptoStore.getState().cachedEnvelope
  if (!envelope) throw new Error('No cached envelope — vault is locked')
  const versions = envelope.fieldKeys.filter((k) => k.fieldName === fieldName).map((k) => k.version)
  if (versions.length === 0) throw new Error(`No field key found for "${fieldName}"`)
  return Math.max(...versions)
}

/**
 * Atomically rotate one field's key: re-encrypt every entry's ciphertext for
 * that field and swap the wrapped key server-side in a single transaction,
 * then update the local vault + cache.
 */
export async function rotateFieldKey(userId: string, fieldName: FieldName): Promise<void> {
  const kek = keyVault.getKey('kek')
  const oldFieldKey = keyVault.getKey(fieldName)
  if (!kek || !oldFieldKey) throw new Error('Vault is locked — cannot rotate')

  const currentVersion = maxVersionForField(fieldName)
  const currentCiphertexts = await fetchAllEncryptedFieldsForUser(userId, fieldName)

  const result = await rotateFieldKeyCrypto({
    kek,
    oldFieldKey,
    fieldName,
    currentVersion,
    currentCiphertexts: currentCiphertexts.map((f) => ({
      entryId: f.entryId,
      ciphertext: f.ciphertext,
      ciphertextIv: f.ciphertextIV,
    })),
  })

  // Mark this rotation as locally initiated so the realtime echo of our own
  // write doesn't double-toast. Placed right before the RPC so the marker
  // is set before the DB write can trigger the broadcast.
  markLocalKeyRotation(fieldName, result.newVersion)

  await rotateFieldKeyRpc({
    fieldName,
    newVersion: result.newVersion,
    newWrappedFieldKey: result.newWrappedFieldKey,
    newFieldKeyIv: result.newFieldKeyIv,
    reEncryptedFields: result.reEncryptedFields,
  })

  // Local state update only. Store the new key and update the cached envelope.
  keyVault.storeKey(fieldName, result.newCryptoKey)
  useCryptoStore.getState().updateCachedFieldKey({
    fieldName,
    newVersion: result.newVersion,
    newWrappedFieldKey: result.newWrappedFieldKey,
    newFieldKeyIv: result.newFieldKeyIv,
  })
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
      await rotateFieldKey(userId, fieldName)
      outcomes.push({ fieldName, ok: true, newVersion: maxVersionForField(fieldName) })
    } catch (error) {
      outcomes.push({ fieldName, ok: false, error })
    }
  }
  return outcomes
}
