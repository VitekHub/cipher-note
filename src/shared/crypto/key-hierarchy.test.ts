import { describe, it, expect } from 'vitest'
import { DecryptionError } from '@/shared/crypto/errors'
import {
  generateMasterKey,
  generateFieldKey,
  deriveFullKeyHierarchy,
  wrapFieldKeys,
  unwrapFieldKeys,
} from '@/shared/crypto/key-hierarchy'

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

  describe('generateFieldKey', () => {
    it('produces a 32-byte key', () => {
      const key = generateFieldKey()
      expect(key.length).toBe(32)
    })

    it('produces unique keys on successive calls', () => {
      const key1 = generateFieldKey()
      const key2 = generateFieldKey()
      expect(key1).not.toEqual(key2)
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

      const kek1 = await crypto.subtle.exportKey('raw', h1.kek)
      const kek2 = await crypto.subtle.exportKey('raw', h2.kek)
      expect(new Uint8Array(kek1)).toEqual(new Uint8Array(kek2))
    })

    it('produces different KEK for different master keys', async () => {
      const mk1 = generateMasterKey()
      const mk2 = generateMasterKey()
      const h1 = await deriveFullKeyHierarchy(mk1)
      const h2 = await deriveFullKeyHierarchy(mk2)

      const kek1 = await crypto.subtle.exportKey('raw', h1.kek)
      const kek2 = await crypto.subtle.exportKey('raw', h2.kek)
      expect(new Uint8Array(kek1)).not.toEqual(new Uint8Array(kek2))
    })
  })

  describe('wrapFieldKeys and unwrapFieldKeys', () => {
    async function setupHierarchy() {
      const masterKey = generateMasterKey()
      const hierarchy = await deriveFullKeyHierarchy(masterKey)

      const fieldKeys = new Map<string, Uint8Array<ArrayBuffer>>([
        ['note', generateFieldKey()],
        ['website', generateFieldKey()],
        ['email', generateFieldKey()],
      ])

      const versions = new Map<string, number>([
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      return { hierarchy, fieldKeys, versions }
    }

    it('round-trips all field keys through wrap and unwrap', async () => {
      const { hierarchy, fieldKeys, versions } = await setupHierarchy()

      const wrapped = await wrapFieldKeys(fieldKeys, hierarchy.kek, versions)
      const unwrapped = await unwrapFieldKeys(wrapped, hierarchy.kek)

      for (const [fieldName, originalKey] of fieldKeys) {
        expect(unwrapped.get(fieldName)).toEqual(originalKey)
      }
    })

    it('preserves field names and versions in wrapped output', async () => {
      const { hierarchy, fieldKeys, versions } = await setupHierarchy()

      const wrapped = await wrapFieldKeys(fieldKeys, hierarchy.kek, versions)

      const fieldNames = wrapped.map((w) => w.fieldName).sort()
      expect(fieldNames).toEqual(['email', 'note', 'website'])

      for (const w of wrapped) {
        expect(w.version).toBe(versions.get(w.fieldName))
      }
    })

    it('produces wrapped keys that differ from plaintext keys', async () => {
      const { hierarchy, fieldKeys, versions } = await setupHierarchy()

      const wrapped = await wrapFieldKeys(fieldKeys, hierarchy.kek, versions)

      for (const w of wrapped) {
        expect(w.wrappedKey).not.toEqual(fieldKeys.get(w.fieldName))
      }
    })

    it('throws DecryptionError when unwrapping with wrong KEK', async () => {
      const { fieldKeys, versions } = await setupHierarchy()
      const wrongHierarchy = await deriveFullKeyHierarchy(generateMasterKey())

      const wrapped = await wrapFieldKeys(fieldKeys, wrongHierarchy.kek, versions)

      // Try to unwrap with a different KEK
      const anotherHierarchy = await deriveFullKeyHierarchy(generateMasterKey())
      await expect(unwrapFieldKeys(wrapped, anotherHierarchy.kek)).rejects.toThrow(DecryptionError)
    })

    it('throws DecryptionError when unwrapping with wrong version (rollback protection)', async () => {
      const { hierarchy, fieldKeys } = await setupHierarchy()
      const versions = new Map<string, number>([
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      const wrapped = await wrapFieldKeys(fieldKeys, hierarchy.kek, versions)

      // Tamper with version to simulate rollback
      const tampered = wrapped.map((w) => ({
        ...w,
        version: w.version + 1,
      }))

      await expect(unwrapFieldKeys(tampered, hierarchy.kek)).rejects.toThrow(DecryptionError)
    })

    it('throws if version is missing for a field name', async () => {
      const { hierarchy, fieldKeys } = await setupHierarchy()
      // Missing 'email' version
      const incompleteVersions = new Map<string, number>([
        ['note', 1],
        ['website', 1],
      ])

      await expect(wrapFieldKeys(fieldKeys, hierarchy.kek, incompleteVersions)).rejects.toThrow(
        'Missing version for field "email"',
      )
    })

    it('wraps and unwraps a single field key', async () => {
      const masterKey = generateMasterKey()
      const hierarchy = await deriveFullKeyHierarchy(masterKey)
      const fieldKeys = new Map<string, Uint8Array<ArrayBuffer>>([['note', generateFieldKey()]])
      const versions = new Map<string, number>([['note', 1]])

      const wrapped = await wrapFieldKeys(fieldKeys, hierarchy.kek, versions)
      const unwrapped = await unwrapFieldKeys(wrapped, hierarchy.kek)

      expect(unwrapped.get('note')).toEqual(fieldKeys.get('note'))
    })
  })

  describe('full round-trip', () => {
    it('generates master key, derives hierarchy, wraps/unwraps field keys', async () => {
      // 1. Generate master key
      const masterKey = generateMasterKey()

      // 2. Derive key hierarchy
      const hierarchy = await deriveFullKeyHierarchy(masterKey)

      // 3. Generate field keys
      const noteKey = generateFieldKey()
      const websiteKey = generateFieldKey()
      const emailKey = generateFieldKey()
      const fieldKeys = new Map<string, Uint8Array<ArrayBuffer>>([
        ['note', noteKey],
        ['website', websiteKey],
        ['email', emailKey],
      ])
      const versions = new Map<string, number>([
        ['note', 1],
        ['website', 1],
        ['email', 1],
      ])

      // 4. Wrap field keys with KEK
      const wrapped = await wrapFieldKeys(fieldKeys, hierarchy.kek, versions)

      // 5. Unwrap field keys with KEK
      const unwrapped = await unwrapFieldKeys(wrapped, hierarchy.kek)

      // 6. Verify all field keys match originals
      expect(unwrapped.get('note')).toEqual(noteKey)
      expect(unwrapped.get('website')).toEqual(websiteKey)
      expect(unwrapped.get('email')).toEqual(emailKey)
    })
  })
})
