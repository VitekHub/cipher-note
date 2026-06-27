import { describe, it, expect } from 'vitest'
import { importKey } from '@/shared/crypto/aes-gcm'
import { DecryptionError } from '@/shared/crypto/errors'
import { encryptField, decryptField, toSaveFieldData, toEncryptedFieldData } from '@/features/fields/model/field-crypto'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'
import type { FieldName } from '@/shared/types/entities/field.types'

const generateKey = async () => await importKey(crypto.getRandomValues(new Uint8Array(32)))

describe('encryptField + decryptField', () => {
  it('round-trips plaintext for all field names', async () => {
    const key = await generateKey()
    for (const fieldName of FIELD_NAMES) {
      const plaintext = `Hello, ${fieldName}!`
      const encrypted = await encryptField(plaintext, key, fieldName)
      const decrypted = await decryptField(encrypted, key, fieldName)
      expect(decrypted).toBe(plaintext)
    }
  })

  it('round-trips an empty string', async () => {
    const key = await generateKey()
    const encrypted = await encryptField('', key, 'note')
    const decrypted = await decryptField(encrypted, key, 'note')
    expect(decrypted).toBe('')
  })

  it('round-trips a long string', async () => {
    const key = await generateKey()
    const plaintext = 'a'.repeat(10_000)
    const encrypted = await encryptField(plaintext, key, 'note')
    const decrypted = await decryptField(encrypted, key, 'note')
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertexts for different IVs (randomness)', async () => {
    const key = await generateKey()
    const plaintext = 'same content'
    const encrypted1 = await encryptField(plaintext, key, 'note')
    const encrypted2 = await encryptField(plaintext, key, 'note')
    // Random IV means ciphertext should differ each time
    expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext)
  })

  it('produces different ciphertexts with different keys', async () => {
    const key1 = await generateKey()
    const key2 = await generateKey()
    const plaintext = 'same content'
    const encrypted1 = await encryptField(plaintext, key1, 'note')
    const encrypted2 = await encryptField(plaintext, key2, 'note')
    expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext)
  })

  it('throws DecryptionError with wrong key', async () => {
    const key1 = await generateKey()
    const key2 = await generateKey()
    const encrypted = await encryptField('secret', key1, 'note')
    await expect(decryptField(encrypted, key2, 'note')).rejects.toThrow(DecryptionError)
  })

  it('throws DecryptionError when field name mismatches (AAD binding)', async () => {
    const key = await generateKey()
    const encrypted = await encryptField('secret note', key, 'note')
    // Attempt to decrypt as a different field — AAD won't match
    await expect(decryptField(encrypted, key, 'website')).rejects.toThrow(DecryptionError)
  })
})

describe('toSaveFieldData + toEncryptedFieldData', () => {
  it('round-trips through hex encoding/decoding', async () => {
    const key = await generateKey()
    const plaintext = 'test data for hex round-trip'
    const encrypted = await encryptField(plaintext, key, 'note')

    // Internal binary → hex for API
    const saveData = toSaveFieldData(encrypted, 'entry-1', 'note')
    expect(typeof saveData.ciphertext).toBe('string')
    expect(typeof saveData.ciphertextIV).toBe('string')

    // Hex from API → internal binary
    const serverField = {
      entryId: 'entry-1',
      fieldName: 'note' as FieldName,
      ciphertext: saveData.ciphertext,
      ciphertextIV: saveData.ciphertextIV,
      updatedAt: '2025-01-01T00:00:00Z',
    }
    const restored = toEncryptedFieldData(serverField)
    expect(restored.ciphertext).toEqual(encrypted.ciphertext)
    expect(restored.ciphertextIV).toEqual(encrypted.ciphertextIV)

    // Full round-trip: encrypt → toSaveFieldData → toEncryptedFieldData → decrypt
    const decrypted = await decryptField(restored, key, 'note')
    expect(decrypted).toBe(plaintext)
  })
})
