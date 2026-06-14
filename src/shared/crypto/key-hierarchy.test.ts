import { describe, it, expect } from 'vitest'
import { DecryptionError } from '@/shared/crypto/errors'
import { hexEncode } from '@/shared/crypto/crypto-utils'
import {
  generateMasterKey,
  generateFieldKeys,
  deriveFullKeyHierarchy,
  wrapFieldKeys,
  unwrapFieldKeys,
} from '@/shared/crypto/key-hierarchy'
import type { ServerFieldKey } from '@/shared/types/api.types'

describe('key-hierarchy', () => {
  describe('generateMasterKey', () => {
    it('produces a 32-byte key', () => {
      const key = generateMasterKey()
      expect(key.length).toBe(32)
    })

    it('produces unique keys on successive calls', () => {
      const key1 = generateMasterKey()
      const key2 = generateMasterKey()
      expect(key1).not.toEqual(key2)
    })
  })

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

  describe('deriveFullKeyHierarchy', () => {
    it('returns masterKey, kek, and signingKeySeed', async () => {
      const masterKey = generateMasterKey()
      const hierarchy = await deriveFullKeyHierarchy(masterKey)

      expect(hierarchy.masterKey).toEqual(masterKey)
      expect(hierarchy.kek).toBeInstanceOf(CryptoKey)
      expect(hierarchy.signingKeySeed.length).toBe(32)
    })

    it('produces deterministic KEK for same master key', async () => {
      const masterKey = generateMasterKey()
      const h1 = await deriveFullKeyHierarchy(masterKey)
      const h2 = await deriveFullKeyHierarchy(masterKey)

      // Compare ciphertexts from encrypting same data with both KEKs
      const testPlaintext = new Uint8Array(32).fill(0x42)
      const iv = new Uint8Array(12).fill(0x00)

      const ciphertext1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, h1.kek, testPlaintext)
      const ciphertext2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, h2.kek, testPlaintext)

      expect(new Uint8Array(ciphertext1)).toEqual(new Uint8Array(ciphertext2))
    })

    it('produces different KEK for different master keys', async () => {
      const mk1 = generateMasterKey()
      const mk2 = generateMasterKey()
      const h1 = await deriveFullKeyHierarchy(mk1)
      const h2 = await deriveFullKeyHierarchy(mk2)

      // Compare ciphertexts from encrypting same data with both KEKs
      const testPlaintext = new Uint8Array(32).fill(0x42)
      const iv = new Uint8Array(12).fill(0x00)

      const ciphertext1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, h1.kek, testPlaintext)
      const ciphertext2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, h2.kek, testPlaintext)

      expect(new Uint8Array(ciphertext1)).not.toEqual(new Uint8Array(ciphertext2))
    })
  })

  describe('wrapFieldKeys and unwrapFieldKeys', () => {
    async function setupHierarchy() {
      const masterKey = generateMasterKey()
      const hierarchy = await deriveFullKeyHierarchy(masterKey)

      const { rawFieldKeys, cryptoFieldKeys } = await generateFieldKeys()

      const versions = new Map<string, number>([
        ['title', 1],
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      return { hierarchy, rawFieldKeys, cryptoFieldKeys, versions }
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
      const { hierarchy, rawFieldKeys, versions } = await setupHierarchy()

      const wrapped = await wrapFieldKeys(rawFieldKeys, hierarchy.kek, versions)
      const serverFieldKeys = toServerFieldKeys(wrapped)
      const unwrapped = await unwrapFieldKeys(serverFieldKeys, hierarchy.kek)

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
      const { hierarchy, rawFieldKeys, versions } = await setupHierarchy()

      const wrapped = await wrapFieldKeys(rawFieldKeys, hierarchy.kek, versions)

      const fieldNames = wrapped.map((w) => w.fieldName).sort()
      expect(fieldNames).toEqual(['email', 'note', 'title', 'website'])

      for (const w of wrapped) {
        expect(w.version).toBe(versions.get(w.fieldName))
      }
    })

    it('produces wrapped keys that differ from plaintext keys', async () => {
      const { hierarchy, rawFieldKeys, versions } = await setupHierarchy()

      const wrapped = await wrapFieldKeys(rawFieldKeys, hierarchy.kek, versions)

      for (const w of wrapped) {
        expect(w.wrappedKey).not.toEqual(rawFieldKeys.get(w.fieldName))
      }
    })

    it('throws DecryptionError when unwrapping with wrong KEK', async () => {
      const { rawFieldKeys, versions } = await setupHierarchy()
      const wrongHierarchy = await deriveFullKeyHierarchy(generateMasterKey())

      const wrapped = await wrapFieldKeys(rawFieldKeys, wrongHierarchy.kek, versions)

      // Try to unwrap with a different KEK
      const anotherHierarchy = await deriveFullKeyHierarchy(generateMasterKey())
      const serverFieldKeys = toServerFieldKeys(wrapped)
      await expect(unwrapFieldKeys(serverFieldKeys, anotherHierarchy.kek)).rejects.toThrow(DecryptionError)
    })

    it('throws DecryptionError when unwrapping with wrong version (rollback protection)', async () => {
      const { hierarchy, rawFieldKeys } = await setupHierarchy()
      const versions = new Map<string, number>([
        ['title', 1],
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      const wrapped = await wrapFieldKeys(rawFieldKeys, hierarchy.kek, versions)

      // Tamper with version to simulate rollback
      const tampered = wrapped.map((w) => ({
        ...w,
        version: w.version + 1,
      }))

      await expect(unwrapFieldKeys(toServerFieldKeys(tampered), hierarchy.kek)).rejects.toThrow(DecryptionError)
    })

    it('throws if version is missing for a field name', async () => {
      const { hierarchy, rawFieldKeys } = await setupHierarchy()
      // Missing 'email' version
      const incompleteVersions = new Map<string, number>([
        ['note', 1],
        ['website', 1],
        ['title', 1],
      ])

      await expect(wrapFieldKeys(rawFieldKeys, hierarchy.kek, incompleteVersions)).rejects.toThrow(
        'Missing version for field "email"',
      )
    })

    it('wraps and unwraps a single field key', async () => {
      const masterKey = generateMasterKey()
      const hierarchy = await deriveFullKeyHierarchy(masterKey)
      const rawFieldKeys = new Map<string, Uint8Array<ArrayBuffer>>([
        ['note', crypto.getRandomValues(new Uint8Array(32))],
      ])
      const versions = new Map<string, number>([['note', 1]])

      const wrapped = await wrapFieldKeys(rawFieldKeys, hierarchy.kek, versions)
      const unwrapped = await unwrapFieldKeys(toServerFieldKeys(wrapped), hierarchy.kek)

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
      const { hierarchy } = await setupHierarchy()
      const wrapped = await wrapFieldKeys(new Map(), hierarchy.kek, new Map())
      expect(wrapped).toEqual([])
    })

    it('returns empty map for empty wrappedKeys array', async () => {
      const { hierarchy } = await setupHierarchy()
      const unwrapped = await unwrapFieldKeys([], hierarchy.kek)
      expect(unwrapped.size).toBe(0)
    })
  })

  describe('full round-trip', () => {
    it('generates master key, derives hierarchy, wraps/unwraps field keys', async () => {
      // 1. Generate master key
      const masterKey = generateMasterKey()

      // 2. Derive key hierarchy
      const hierarchy = await deriveFullKeyHierarchy(masterKey)

      // 3. Generate field keys
      const { rawFieldKeys } = await generateFieldKeys()
      const versions = new Map<string, number>([
        ['title', 1],
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      // 4. Wrap field keys with KEK
      const wrapped = await wrapFieldKeys(rawFieldKeys, hierarchy.kek, versions)

      // 5. Convert to server format and unwrap
      const serverFieldKeys = wrapped.map((w) => ({
        fieldName: w.fieldName,
        version: w.version,
        wrappedKey: hexEncode(w.wrappedKey),
        keyIV: hexEncode(w.iv),
      }))
      const unwrapped = await unwrapFieldKeys(serverFieldKeys, hierarchy.kek)

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
