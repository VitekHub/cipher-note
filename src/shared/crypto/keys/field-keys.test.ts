import { describe, it, expect, vi } from 'vitest'
import { DecryptionError } from '@/shared/crypto/core/errors'
import * as cryptoUtils from '@/shared/crypto/core/crypto-utils'
import { hexEncode, generateKey, generateIV, encodeAAD, zeroFill } from '@/shared/crypto/core/crypto-utils'
import { generateMasterKey } from '@/shared/crypto/keys/master-key'
import { deriveKEK } from '@/shared/crypto/core/hkdf'
import { importKey, encrypt } from '@/shared/crypto/core/aes-gcm'
import { generateFieldKey, generateAllFieldKeys, unwrapFieldKeys } from '@/shared/crypto/keys/field-keys'
import type { ServerFieldKey } from '@/shared/types/api.types'

describe('field-keys', () => {
  describe('generateFieldKey', () => {
    async function setupKEK() {
      const masterKey = generateMasterKey()
      const kekBytes = await deriveKEK(masterKey)
      const kek = await importKey(kekBytes)
      return { kek }
    }

    it('returns a CryptoKey and correctly wrapped key material', async () => {
      const { kek } = await setupKEK()
      const { cryptoKey, wrappedFieldKey, fieldKeyIV } = await generateFieldKey(kek, 'note', 1)

      expect(cryptoKey).toBeInstanceOf(CryptoKey)
      expect(wrappedFieldKey.length).toBe(48) // 32 bytes + 16-byte GCM tag
      expect(fieldKeyIV.length).toBe(12)
    })

    it('round-trips through wrap and unwrap', async () => {
      const { kek } = await setupKEK()
      const { cryptoKey, wrappedFieldKey, fieldKeyIV } = await generateFieldKey(kek, 'note', 1)

      const aad = encodeAAD('note', 1)
      const unwrappedRaw = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fieldKeyIV, additionalData: aad },
        kek,
        wrappedFieldKey,
      )
      const unwrappedKey = await importKey(new Uint8Array(unwrappedRaw))

      // Both keys produce identical ciphertext for the same plaintext/IV.
      const plaintext = new Uint8Array(32).fill(0x42)
      const iv = new Uint8Array(12).fill(0x00)
      const cipher1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext)
      const cipher2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, unwrappedKey, plaintext)
      expect(new Uint8Array(cipher1)).toEqual(new Uint8Array(cipher2))
    })

    it('uses the provided version in the AAD (rollback protection)', async () => {
      const { kek } = await setupKEK()
      const { wrappedFieldKey, fieldKeyIV } = await generateFieldKey(kek, 'note', 3)

      // Unwrapping with a different version must fail.
      const staleAad = encodeAAD('note', 2)
      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv: fieldKeyIV, additionalData: staleAad }, kek, wrappedFieldKey),
      ).rejects.toThrow()
    })

    it('zero-fills the raw key material', async () => {
      const { kek } = await setupKEK()
      const rawKey = new Uint8Array(32).fill(0xab)
      const spy = vi.spyOn(cryptoUtils, 'generateKey').mockReturnValue(rawKey)

      try {
        await generateFieldKey(kek, 'note', 1)
        expect(Array.from(rawKey)).toEqual(new Array(32).fill(0))
      } finally {
        spy.mockRestore()
      }
    })
  })

  describe('generateAllFieldKeys', () => {
    async function setupKEK() {
      const masterKey = generateMasterKey()
      const kekBytes = await deriveKEK(masterKey)
      const kek = await importKey(kekBytes)
      return { kek }
    }

    it('returns cryptoFieldKeys and wrappedFieldKeys for all four fields', async () => {
      const { kek } = await setupKEK()
      const { cryptoFieldKeys, wrappedFieldKeys } = await generateAllFieldKeys(kek)

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
      const { cryptoFieldKeys } = await generateAllFieldKeys(kek)
      for (const key of cryptoFieldKeys.values()) {
        expect(key).toBeInstanceOf(CryptoKey)
      }
    })

    it('produces wrapped keys of correct size with version', async () => {
      const { kek } = await setupKEK()
      const { wrappedFieldKeys } = await generateAllFieldKeys(kek)
      for (const w of wrappedFieldKeys) {
        expect(w.wrappedFieldKey.length).toBe(48) // 32 bytes + 16 byte GCM tag
        expect(w.fieldKeyIV.length).toBe(12)
        expect(w.version).toBe(1) // FIELD_KEY_VERSION
      }
    })

    it('round-trips through wrap and unwrap', async () => {
      const { kek } = await setupKEK()
      const { cryptoFieldKeys, wrappedFieldKeys } = await generateAllFieldKeys(kek)

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
      const { wrappedFieldKeys } = await generateAllFieldKeys(kek)
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
      const { wrappedFieldKeys } = await generateAllFieldKeys(kek)

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

    it('keeps the last key when two versions are present for a field (atomic-swap guard)', async () => {
      // After an atomic rotation the server holds exactly one version per
      // field. If a multi-version state were ever reintroduced, unwrapFieldKeys
      // builds a Map keyed by fieldName so the last entry wins — this test
      // pins that behavior as a regression guard.
      const { kek } = await setupKEK()

      const v1Raw = generateKey()
      const v1Crypto = await importKey(v1Raw)
      const v1IV = generateIV()
      const v1Wrapped = await encrypt(v1Raw, kek, { iv: v1IV, aad: encodeAAD('note', 1) })

      const v2Raw = generateKey()
      const v2Crypto = await importKey(v2Raw)
      const v2IV = generateIV()
      const v2Wrapped = await encrypt(v2Raw, kek, { iv: v2IV, aad: encodeAAD('note', 2) })
      zeroFill([v1Raw, v2Raw])

      const serverFieldKeys: ServerFieldKey[] = [
        { fieldName: 'note', version: 1, wrappedFieldKey: hexEncode(v1Wrapped), fieldKeyIV: hexEncode(v1IV) },
        { fieldName: 'note', version: 2, wrappedFieldKey: hexEncode(v2Wrapped), fieldKeyIV: hexEncode(v2IV) },
      ]

      const unwrapped = await unwrapFieldKeys(serverFieldKeys, kek)
      expect(unwrapped.size).toBe(1)

      const noteKey = unwrapped.get('note')!
      const plaintext = new Uint8Array(32).fill(0x42)
      const iv = new Uint8Array(12).fill(0x00)

      const cipherV2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, v2Crypto, plaintext)
      const cipherMap = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, noteKey, plaintext)
      // The map holds the v2 key (last entry wins) — not the v1 key.
      expect(new Uint8Array(cipherMap)).toEqual(new Uint8Array(cipherV2))

      const cipherV1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, v1Crypto, plaintext)
      expect(new Uint8Array(cipherMap)).not.toEqual(new Uint8Array(cipherV1))
    })
  })
})
