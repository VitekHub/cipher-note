import { describe, it, expect } from 'vitest'
import { DecryptionError } from '@/shared/crypto/errors'
import { hexEncode } from '@/shared/crypto/crypto-utils'
import { generateMasterKey } from '@/shared/crypto/master-key'
import { deriveKEK } from '@/shared/crypto/hkdf'
import { importKey } from '@/shared/crypto/aes-gcm'
import { generateFieldKeys, generateAndWrapFieldKeys, wrapFieldKeys, unwrapFieldKeys } from '@/shared/crypto/field-keys'
import type { ServerFieldKey } from '@/shared/types/api.types'

describe('field-keys', () => {
  describe('generateFieldKeys', () => {
    it('returns rawFieldKeys and cryptoFieldKeys with title, note, website, and email', async () => {
      const { rawFieldKeys, cryptoFieldKeys } = await generateFieldKeys()
      expect(rawFieldKeys.size).toBe(4)
      expect(cryptoFieldKeys.size).toBe(4)
      expect(rawFieldKeys.has('title')).toBe(true)
      expect(rawFieldKeys.has('note')).toBe(true)
      expect(rawFieldKeys.has('website')).toBe(true)
      expect(rawFieldKeys.has('email')).toBe(true)
      expect(cryptoFieldKeys.has('title')).toBe(true)
      expect(cryptoFieldKeys.has('note')).toBe(true)
      expect(cryptoFieldKeys.has('website')).toBe(true)
      expect(cryptoFieldKeys.has('email')).toBe(true)
    })

    it('produces 32-byte raw keys for each field', async () => {
      const { rawFieldKeys } = await generateFieldKeys()
      for (const key of rawFieldKeys.values()) {
        expect(key.length).toBe(32)
      }
    })

    it('produces CryptoKey instances for each field', async () => {
      const { cryptoFieldKeys } = await generateFieldKeys()
      for (const key of cryptoFieldKeys.values()) {
        expect(key).toBeInstanceOf(CryptoKey)
      }
    })

    it('produces unique raw keys for each field', async () => {
      const { rawFieldKeys } = await generateFieldKeys()
      const keys = [...rawFieldKeys.values()]
      expect(keys[0]).not.toEqual(keys[1])
      expect(keys[0]).not.toEqual(keys[2])
      expect(keys[1]).not.toEqual(keys[2])
    })

    it('produces unique keys on successive calls', async () => {
      const { rawFieldKeys: r1 } = await generateFieldKeys()
      const { rawFieldKeys: r2 } = await generateFieldKeys()
      expect(r1.get('note')).not.toEqual(r2.get('note'))
    })
  })

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
        expect(w.wrappedKey.length).toBe(48) // 32 bytes + 16 byte GCM tag
        expect(w.iv.length).toBe(12)
        expect(w.version).toBe(1) // FIELD_KEY_VERSION
      }
    })

    it('round-trips through wrap and unwrap', async () => {
      const { kek } = await setupKEK()
      const { cryptoFieldKeys, wrappedFieldKeys } = await generateAndWrapFieldKeys(kek)

      const serverFieldKeys: ServerFieldKey[] = wrappedFieldKeys.map((w) => ({
        fieldName: w.fieldName,
        version: w.version,
        wrappedKey: hexEncode(w.wrappedKey),
        keyIV: hexEncode(w.iv),
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
  })

  describe('wrapFieldKeys and unwrapFieldKeys', () => {
    async function setupKEK() {
      const masterKey = generateMasterKey()
      const kekBytes = await deriveKEK(masterKey)
      const kek = await importKey(kekBytes)
      return { kek }
    }

    function toServerFieldKeys(
      wrapped: {
        fieldName: string
        version: number
        wrappedKey: Uint8Array<ArrayBuffer>
        iv: Uint8Array<ArrayBuffer>
      }[],
    ): ServerFieldKey[] {
      return wrapped.map((w) => ({
        fieldName: w.fieldName,
        version: w.version,
        wrappedKey: hexEncode(w.wrappedKey),
        keyIV: hexEncode(w.iv),
      }))
    }

    it('round-trips all field keys through wrap and unwrap', async () => {
      const { kek } = await setupKEK()
      const { rawFieldKeys } = await generateFieldKeys()
      const versions = new Map<string, number>([
        ['title', 1],
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      const wrapped = await wrapFieldKeys(rawFieldKeys, kek, versions)
      const serverFieldKeys = toServerFieldKeys(wrapped)
      const unwrapped = await unwrapFieldKeys(serverFieldKeys, kek)

      // Compare by encrypting same data with both original CryptoKey and unwrapped CryptoKey
      for (const [fieldName, originalKey] of rawFieldKeys) {
        const unwrappedKey = unwrapped.get(fieldName)!
        const testPlaintext = new Uint8Array(32).fill(0x42)
        const iv = new Uint8Array(12).fill(0x00)

        const ciphertextOriginal = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          await crypto.subtle.importKey('raw', originalKey, { name: 'AES-GCM' }, false, ['encrypt']),
          testPlaintext,
        )
        const ciphertextUnwrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, unwrappedKey, testPlaintext)

        expect(new Uint8Array(ciphertextOriginal)).toEqual(new Uint8Array(ciphertextUnwrapped))
      }
    })

    it('preserves field names and versions in wrapped output', async () => {
      const { kek } = await setupKEK()
      const { rawFieldKeys } = await generateFieldKeys()
      const versions = new Map<string, number>([
        ['title', 1],
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      const wrapped = await wrapFieldKeys(rawFieldKeys, kek, versions)

      const fieldNames = wrapped.map((w) => w.fieldName).sort()
      expect(fieldNames).toEqual(['email', 'note', 'title', 'website'])

      for (const w of wrapped) {
        expect(w.version).toBe(versions.get(w.fieldName))
      }
    })

    it('produces wrapped keys that differ from plaintext keys', async () => {
      const { kek } = await setupKEK()
      const { rawFieldKeys } = await generateFieldKeys()
      const versions = new Map<string, number>([
        ['title', 1],
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      const wrapped = await wrapFieldKeys(rawFieldKeys, kek, versions)

      for (const w of wrapped) {
        expect(w.wrappedKey).not.toEqual(rawFieldKeys.get(w.fieldName))
      }
    })

    it('throws DecryptionError when unwrapping with wrong KEK', async () => {
      const masterKey = generateMasterKey()
      const kekBytes1 = await deriveKEK(masterKey)
      const kek1 = await importKey(kekBytes1)
      const { rawFieldKeys } = await generateFieldKeys()
      const versions = new Map<string, number>([
        ['title', 1],
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      const wrapped = await wrapFieldKeys(rawFieldKeys, kek1, versions)

      // Try to unwrap with a different KEK
      const wrongMasterKey = generateMasterKey()
      const wrongKekBytes = await deriveKEK(wrongMasterKey)
      const wrongKek = await importKey(wrongKekBytes)
      const serverFieldKeys = toServerFieldKeys(wrapped)
      await expect(unwrapFieldKeys(serverFieldKeys, wrongKek)).rejects.toThrow(DecryptionError)
    })

    it('throws DecryptionError when unwrapping with wrong version (rollback protection)', async () => {
      const { kek } = await setupKEK()
      const { rawFieldKeys } = await generateFieldKeys()
      const versions = new Map<string, number>([
        ['title', 1],
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      const wrapped = await wrapFieldKeys(rawFieldKeys, kek, versions)

      // Tamper with version to simulate rollback
      const tampered = wrapped.map((w) => ({
        ...w,
        version: w.version + 1,
      }))

      await expect(unwrapFieldKeys(toServerFieldKeys(tampered), kek)).rejects.toThrow(DecryptionError)
    })

    it('throws if version is missing for a field name', async () => {
      const { kek } = await setupKEK()
      const { rawFieldKeys } = await generateFieldKeys()
      // Missing 'email' version
      const incompleteVersions = new Map<string, number>([
        ['note', 1],
        ['website', 1],
        ['title', 1],
      ])

      await expect(wrapFieldKeys(rawFieldKeys, kek, incompleteVersions)).rejects.toThrow(
        'Missing version for field "email"',
      )
    })

    it('wraps and unwraps a single field key', async () => {
      const { kek } = await setupKEK()
      const rawFieldKeys = new Map<string, Uint8Array<ArrayBuffer>>([
        ['note', crypto.getRandomValues(new Uint8Array(32))],
      ])
      const versions = new Map<string, number>([['note', 1]])

      const wrapped = await wrapFieldKeys(rawFieldKeys, kek, versions)
      const unwrapped = await unwrapFieldKeys(toServerFieldKeys(wrapped), kek)

      // Verify by encrypting same data
      const testPlaintext = new Uint8Array(32).fill(0x42)
      const iv = new Uint8Array(12).fill(0x00)
      const ciphertextOriginal = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        await crypto.subtle.importKey('raw', rawFieldKeys.get('note')!, { name: 'AES-GCM' }, false, ['encrypt']),
        testPlaintext,
      )
      const ciphertextUnwrapped = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        unwrapped.get('note')!,
        testPlaintext,
      )

      expect(new Uint8Array(ciphertextOriginal)).toEqual(new Uint8Array(ciphertextUnwrapped))
    })

    it('returns empty array for empty fieldKeys map', async () => {
      const { kek } = await setupKEK()
      const wrapped = await wrapFieldKeys(new Map(), kek, new Map())
      expect(wrapped).toEqual([])
    })

    it('returns empty map for empty wrappedKeys array', async () => {
      const { kek } = await setupKEK()
      const unwrapped = await unwrapFieldKeys([], kek)
      expect(unwrapped.size).toBe(0)
    })
  })

  describe('full round-trip', () => {
    it('generates master key, derives KEK, wraps/unwraps field keys', async () => {
      // 1. Generate master key
      const masterKey = generateMasterKey()

      // 2. Derive KEK
      const kekBytes = await deriveKEK(masterKey)
      const kek = await importKey(kekBytes)

      // 3. Generate field keys
      const { rawFieldKeys } = await generateFieldKeys()
      const versions = new Map<string, number>([
        ['title', 1],
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      // 4. Wrap field keys with KEK
      const wrapped = await wrapFieldKeys(rawFieldKeys, kek, versions)

      // 5. Convert to server format and unwrap
      const serverFieldKeys = wrapped.map((w) => ({
        fieldName: w.fieldName,
        version: w.version,
        wrappedKey: hexEncode(w.wrappedKey),
        keyIV: hexEncode(w.iv),
      }))
      const unwrapped = await unwrapFieldKeys(serverFieldKeys, kek)

      // 6. Verify by encrypting same data with both original and unwrapped keys
      const testPlaintext = new Uint8Array(32).fill(0x42)
      const iv = new Uint8Array(12).fill(0x00)

      for (const [fieldName, originalKey] of rawFieldKeys) {
        const ciphertextOriginal = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          await crypto.subtle.importKey('raw', originalKey, { name: 'AES-GCM' }, false, ['encrypt']),
          testPlaintext,
        )
        const ciphertextUnwrapped = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          unwrapped.get(fieldName)!,
          testPlaintext,
        )

        expect(new Uint8Array(ciphertextOriginal)).toEqual(new Uint8Array(ciphertextUnwrapped))
      }
    })
  })
})
