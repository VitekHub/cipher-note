import { describe, it, expect } from 'vitest'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { hexEncode } from '@/shared/crypto/core/crypto-utils'
import { generateMasterKey } from '@/shared/crypto/keys/master-key'
import { deriveKEK } from '@/shared/crypto/core/hkdf'
import { importKey } from '@/shared/crypto/core/aes-gcm'
import { generateAndWrapFieldKeys, unwrapFieldKeys } from '@/shared/crypto/keys/field-keys'
import type { ServerFieldKey } from '@/shared/types/api.types'

describe('field-keys', () => {
  describe('generateAndWrapFieldKeys', () => {
    async function setupKEK() {
      const masterKey = generateMasterKey()
      const kekBytes = await deriveKEK(masterKey)
      const kek = await importKey(kekBytes)
      return { kek }
    }

    it('returns cryptoFieldKeys and wrappedFieldKeys for all four fields', async () => {
      const { kek } = await setupKEK()
      const { cryptoFieldKeys, wrappedFieldKeys } = await generateAndWrapFieldKeys(kek)

      expect(cryptoFieldKeys.size).toBe(4)
      expect(wrappedFieldKeys).toHaveLength(4)

      expect(cryptoFieldKeys.has('title')).toBe(true)
      expect(cryptoFieldKeys.has('note')).toBe(true)
      expect(cryptoFieldKeys.has('website')).toBe(true)
      expect(cryptoFieldKeys.has('email')).toBe(true)

      const fieldNames = wrappedFieldKeys.map((w) => w.fieldName).sort()
      expect(fieldNames).toEqual(['email', 'note', 'title', 'website'])
    })

    it('produces CryptoKey instances for each field', async () => {
      const { kek } = await setupKEK()
      const { cryptoFieldKeys } = await generateAndWrapFieldKeys(kek)
      for (const key of cryptoFieldKeys.values()) {
        expect(key).toBeInstanceOf(CryptoKey)
      }
    })

    it('produces wrapped keys of correct size with version', async () => {
      const { kek } = await setupKEK()
      const { wrappedFieldKeys } = await generateAndWrapFieldKeys(kek)
      for (const w of wrappedFieldKeys) {
        expect(w.wrappedFieldKey.length).toBe(48) // 32 bytes + 16 byte GCM tag
        expect(w.fieldKeyIV.length).toBe(12)
        expect(w.version).toBe(1) // FIELD_KEY_VERSION
      }
    })

    it('round-trips through wrap and unwrap', async () => {
      const { kek } = await setupKEK()
      const { cryptoFieldKeys, wrappedFieldKeys } = await generateAndWrapFieldKeys(kek)

      const serverFieldKeys: ServerFieldKey[] = wrappedFieldKeys.map((w) => ({
        fieldName: w.fieldName,
        version: w.version,
        wrappedFieldKey: hexEncode(w.wrappedFieldKey),
        fieldKeyIV: hexEncode(w.fieldKeyIV),
      }))

      const unwrapped = await unwrapFieldKeys(serverFieldKeys, kek)

      for (const fieldName of ['title', 'note', 'website', 'email']) {
        const originalKey = cryptoFieldKeys.get(fieldName)!
        const unwrappedKey = unwrapped.get(fieldName)!
        const testPlaintext = new Uint8Array(32).fill(0x42)
        const iv = new Uint8Array(12).fill(0x00)

        const ciphertextOriginal = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, originalKey, testPlaintext)
        const ciphertextUnwrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, unwrappedKey, testPlaintext)

        expect(new Uint8Array(ciphertextOriginal)).toEqual(new Uint8Array(ciphertextUnwrapped))
      }
    })

    it('throws DecryptionError when unwrapping with wrong KEK', async () => {
      const { kek } = await setupKEK()
      const { wrappedFieldKeys } = await generateAndWrapFieldKeys(kek)
      const serverFieldKeys: ServerFieldKey[] = wrappedFieldKeys.map((w) => ({
        fieldName: w.fieldName,
        version: w.version,
        wrappedFieldKey: hexEncode(w.wrappedFieldKey),
        fieldKeyIV: hexEncode(w.fieldKeyIV),
      }))

      const wrongMasterKey = generateMasterKey()
      const wrongKekBytes = await deriveKEK(wrongMasterKey)
      const wrongKek = await importKey(wrongKekBytes)
      await expect(unwrapFieldKeys(serverFieldKeys, wrongKek)).rejects.toThrow(DecryptionError)
    })

    it('throws DecryptionError when unwrapping with wrong version (rollback protection)', async () => {
      const { kek } = await setupKEK()
      const { wrappedFieldKeys } = await generateAndWrapFieldKeys(kek)

      const tampered = wrappedFieldKeys.map((w) => ({
        ...w,
        version: w.version + 1,
      }))
      const serverFieldKeys: ServerFieldKey[] = tampered.map((w) => ({
        fieldName: w.fieldName,
        version: w.version,
        wrappedFieldKey: hexEncode(w.wrappedFieldKey),
        fieldKeyIV: hexEncode(w.fieldKeyIV),
      }))

      await expect(unwrapFieldKeys(serverFieldKeys, kek)).rejects.toThrow(DecryptionError)
    })

    it('returns empty map for empty wrappedKeys array', async () => {
      const { kek } = await setupKEK()
      const unwrapped = await unwrapFieldKeys([], kek)
      expect(unwrapped.size).toBe(0)
    })
  })
})
