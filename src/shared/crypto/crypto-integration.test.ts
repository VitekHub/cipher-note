import { describe, it, expect, vi, beforeEach } from 'vitest'
import { encrypt, decrypt, importKey } from '@/shared/crypto/aes-gcm'
import {
  generateMasterKey,
  generateFieldKeys,
  deriveFullKeyHierarchy,
  wrapFieldKeys,
  unwrapFieldKeys,
} from '@/shared/crypto/key-hierarchy'
import { deriveAuthCredentials, deriveLoginCredentials, changePassword } from '@/shared/crypto/split-kdf'
import { wrapMasterKeyWithRecovery, unwrapMasterKeyWithRecovery } from '@/shared/crypto/mnemonic'
import { DecryptionError } from '@/shared/crypto/errors'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { WrappedFieldKey } from '@/shared/types/crypto.types'

// Mock Argon2id module — Web Worker won't run in jsdom
vi.mock('@/shared/crypto/argon2id', () => ({
  deriveAuthHash: vi.fn(),
  derivePasswordKey: vi.fn(),
  deriveKey: vi.fn(),
}))

// Mock @scure/bip39 — avoid loading 2048-word dictionary
const MOCK_WORDLIST = Array.from({ length: 2048 }, (_, i) => `word${i}`)
const MOCK_VALID_MNEMONIC = MOCK_WORDLIST.slice(0, 12).join(' ')

vi.mock('@scure/bip39', () => ({
  generateMnemonic: vi.fn().mockReturnValue(MOCK_VALID_MNEMONIC),
  validateMnemonic: vi.fn().mockReturnValue(true),
  mnemonicToSeedSync: vi.fn().mockReturnValue(new Uint8Array(64).fill(0xab)),
}))

vi.mock('@scure/bip39/wordlists/english.js', () => ({
  wordlist: MOCK_WORDLIST,
}))

import { deriveAuthHash, derivePasswordKey, deriveKey } from '@/shared/crypto/argon2id'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

// Mock crypto-utils module — allow generateSalt to be controlled per-test
vi.mock('@/shared/crypto/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/crypto-utils')),
  generateSalt: vi.fn(),
}))
import { generateIV, generateSalt } from '@/shared/crypto/crypto-utils'

const PASSWORD = 'test-password-123'
const PASSWORD_KEY_FILL = 0x11
const NEW_PASSWORD_KEY_FILL = 0x22
const RECOVERY_KEK_FILL = 0x33

async function setupRegistration() {
  const authSalt = mockBytes(16, 0x01)
  const keySalt = mockBytes(16, 0x02)
  vi.mocked(generateSalt).mockReturnValueOnce(authSalt).mockReturnValueOnce(keySalt)
  vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
  vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, PASSWORD_KEY_FILL))

  const masterKey = generateMasterKey()
  const authCreds = await deriveAuthCredentials(PASSWORD)
  const hierarchy = await deriveFullKeyHierarchy(masterKey)
  const fieldKeys = generateFieldKeys()
  const versions = new Map([
    ['note', 1],
    ['website', 1],
    ['email', 1],
  ])
  const wrappedFieldKeys = await wrapFieldKeys(fieldKeys, hierarchy.kek, versions)

  const passwordCryptoKey = await importKey(authCreds.passwordKey)
  const iv = generateIV()
  const wrappedMasterKey = await encrypt(masterKey, passwordCryptoKey, {
    iv,
    aad: MASTER_KEY_PASSWORD_AAD,
  })

  const recoveryIV = generateIV()
  const recoverySalt = mockBytes(16, 0x05)
  vi.mocked(deriveKey).mockResolvedValueOnce(mockBytes(32, RECOVERY_KEK_FILL))
  const recoveryData = await wrapMasterKeyWithRecovery(masterKey, MOCK_VALID_MNEMONIC, {
    iv: recoveryIV,
    salt: recoverySalt,
  })

  return {
    masterKey,
    authCreds,
    hierarchy,
    fieldKeys,
    wrappedFieldKeys,
    wrappedMasterKey,
    masterKeyIV: iv,
    authSalt,
    keySalt,
    recoveryData,
  }
}

describe('crypto integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('registration flow', () => {
    it('generates and wraps all keys consistently', async () => {
      const {
        masterKey,
        hierarchy,
        fieldKeys,
        wrappedFieldKeys,
        wrappedMasterKey,
        masterKeyIV,
        authCreds,
        recoveryData,
      } = await setupRegistration()

      expect(masterKey.byteLength).toBe(32)
      expect(hierarchy.kek.type).toBe('secret')
      expect(hierarchy.signingKeySeed.byteLength).toBe(32)
      expect(fieldKeys.size).toBe(3)
      expect(wrappedFieldKeys).toHaveLength(3)

      // Unwrap field keys
      const unwrappedFieldKeys = await unwrapFieldKeys(wrappedFieldKeys, hierarchy.kek)
      for (const name of ['note', 'website', 'email']) {
        expect(unwrappedFieldKeys.get(name)).toEqual(fieldKeys.get(name))
      }

      // Unwrap master key with password key
      const passwordCryptoKey = await importKey(authCreds.passwordKey)
      const unwrappedMasterKey = await decrypt(wrappedMasterKey, passwordCryptoKey, {
        iv: masterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })
      expect(unwrappedMasterKey).toEqual(masterKey)

      // Unwrap master key with recovery (re-mock deriveKey since it was consumed during setup)
      vi.mocked(deriveKey).mockResolvedValueOnce(mockBytes(32, RECOVERY_KEK_FILL))
      const recoveredMasterKey = await unwrapMasterKeyWithRecovery(recoveryData.wrappedMasterKey, MOCK_VALID_MNEMONIC, {
        iv: recoveryData.recoveryIV,
        salt: recoveryData.recoverySalt,
      })
      expect(recoveredMasterKey).toEqual(masterKey)
    })
  })

  describe('login flow', () => {
    it('recovers all keys from stored server data', async () => {
      const { masterKey, authCreds, wrappedFieldKeys, wrappedMasterKey, masterKeyIV, authSalt, keySalt, fieldKeys } =
        await setupRegistration()
      vi.clearAllMocks()

      vi.mocked(deriveAuthHash).mockResolvedValue(authCreds.authHash)
      vi.mocked(derivePasswordKey).mockResolvedValue(authCreds.passwordKey)

      const loginCreds = await deriveLoginCredentials(PASSWORD, authSalt, keySalt)
      expect(loginCreds.authHash).toBe(authCreds.authHash)
      expect(loginCreds.passwordKey).toEqual(authCreds.passwordKey)
      expect(generateSalt).not.toHaveBeenCalled()

      const passwordCryptoKey = await importKey(loginCreds.passwordKey)
      const unwrappedMasterKey = await decrypt(wrappedMasterKey, passwordCryptoKey, {
        iv: masterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })
      expect(unwrappedMasterKey).toEqual(masterKey)

      const hierarchy = await deriveFullKeyHierarchy(unwrappedMasterKey)
      const unwrappedFieldKeys = await unwrapFieldKeys(wrappedFieldKeys, hierarchy.kek)
      for (const name of ['note', 'website', 'email']) {
        expect(unwrappedFieldKeys.get(name)).toEqual(fieldKeys.get(name))
      }

      // Decrypt actual field content
      const noteKey = unwrappedFieldKeys.get('note')!
      const noteCryptoKey = await importKey(noteKey)
      const plaintext = new TextEncoder().encode('My secret note')
      const iv = generateIV()
      const aad = new Uint8Array([1])
      const ciphertext = await encrypt(plaintext, noteCryptoKey, { iv, aad })
      const decrypted = await decrypt(ciphertext, noteCryptoKey, { iv, aad })
      expect(new TextDecoder().decode(decrypted)).toBe('My secret note')
    })
  })

  describe('password change', () => {
    it('re-wraps master key without changing field keys', async () => {
      const { masterKey, hierarchy, fieldKeys, wrappedFieldKeys, wrappedMasterKey, masterKeyIV, authCreds } =
        await setupRegistration()
      vi.clearAllMocks()

      const newAuthSalt = mockBytes(16, 0xbb)
      const newKeySalt = mockBytes(16, 0xcc)
      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, PASSWORD_KEY_FILL))
        .mockImplementationOnce(async () => mockBytes(32, NEW_PASSWORD_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('b'.repeat(64))
      vi.mocked(generateSalt).mockReturnValueOnce(newAuthSalt).mockReturnValueOnce(newKeySalt)

      const result = await changePassword(
        PASSWORD,
        'new-password-456',
        authCreds.keySalt,
        wrappedMasterKey,
        masterKeyIV,
      )

      const newCryptoKey = await importKey(mockBytes(32, NEW_PASSWORD_KEY_FILL))
      const unwrapped = await decrypt(result.newWrappedMasterKey, newCryptoKey, {
        iv: result.newMasterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })
      expect(unwrapped).toEqual(masterKey)

      // Field keys still decryptable with same KEK
      const unwrappedFieldKeys = await unwrapFieldKeys(wrappedFieldKeys, hierarchy.kek)
      for (const name of ['note', 'website', 'email']) {
        expect(unwrappedFieldKeys.get(name)).toEqual(fieldKeys.get(name))
      }

      // Field content survives password change
      const noteKey = unwrappedFieldKeys.get('note')!
      const noteCryptoKey = await importKey(noteKey)
      const plaintext = new TextEncoder().encode('Persistent data')
      const iv = generateIV()
      const aad = new Uint8Array([1])
      const ciphertext = await encrypt(plaintext, noteCryptoKey, { iv, aad })
      const decrypted = await decrypt(ciphertext, noteCryptoKey, { iv, aad })
      expect(new TextDecoder().decode(decrypted)).toBe('Persistent data')

      // Old password key cannot unwrap new wrapped master key
      const oldCryptoKey = await importKey(mockBytes(32, PASSWORD_KEY_FILL))
      await expect(
        decrypt(result.newWrappedMasterKey, oldCryptoKey, { iv: result.newMasterKeyIV, aad: MASTER_KEY_PASSWORD_AAD }),
      ).rejects.toThrow(DecryptionError)
    })
  })

  describe('seed phrase recovery', () => {
    it('recovers master key and decrypts all fields', async () => {
      const { masterKey, fieldKeys, wrappedFieldKeys, recoveryData } = await setupRegistration()
      vi.clearAllMocks()

      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, RECOVERY_KEK_FILL))
      const recoveredMasterKey = await unwrapMasterKeyWithRecovery(recoveryData.wrappedMasterKey, MOCK_VALID_MNEMONIC, {
        iv: recoveryData.recoveryIV,
        salt: recoveryData.recoverySalt,
      })
      expect(recoveredMasterKey).toEqual(masterKey)

      const recoveredHierarchy = await deriveFullKeyHierarchy(recoveredMasterKey)
      const recoveredFieldKeys = await unwrapFieldKeys(wrappedFieldKeys, recoveredHierarchy.kek)
      for (const name of ['note', 'website', 'email']) {
        expect(recoveredFieldKeys.get(name)).toEqual(fieldKeys.get(name))
      }

      // Decrypt all field content
      for (const name of ['note', 'website', 'email']) {
        const key = recoveredFieldKeys.get(name)!
        const cryptoKey = await importKey(key)
        const plaintext = new TextEncoder().encode(`content for ${name}`)
        const iv = generateIV()
        const aad = new Uint8Array([1])
        const ciphertext = await encrypt(plaintext, cryptoKey, { iv, aad })
        const decrypted = await decrypt(ciphertext, cryptoKey, { iv, aad })
        expect(new TextDecoder().decode(decrypted)).toBe(`content for ${name}`)
      }

      // Wrong mnemonic cannot unwrap
      vi.mocked(deriveKey).mockResolvedValueOnce(mockBytes(32, 0x44))
      await expect(
        unwrapMasterKeyWithRecovery(recoveryData.wrappedMasterKey, 'wrong mnemonic here', {
          iv: recoveryData.recoveryIV,
          salt: recoveryData.recoverySalt,
        }),
      ).rejects.toThrow(DecryptionError)
    })
  })

  describe('key rotation', () => {
    it('rotates one field key without affecting others', async () => {
      const { hierarchy, fieldKeys } = await setupRegistration()
      vi.clearAllMocks()

      // Import original v1 key for later comparison
      const originalNoteKey = fieldKeys.get('note')!
      const originalNoteCryptoKey = await importKey(originalNoteKey)
      const plaintext = new TextEncoder().encode('Sensitive note content')

      // Rotate note key to v2
      const newNoteKey = crypto.getRandomValues(new Uint8Array(32)) as Uint8Array<ArrayBuffer>
      expect(newNoteKey).not.toEqual(originalNoteKey)

      const rotatedFieldKeys = new Map(fieldKeys)
      rotatedFieldKeys.set('note', newNoteKey)
      const newVersions = new Map([
        ['note', 2],
        ['website', 1],
        ['email', 1],
      ])
      const rotatedWrapped = await wrapFieldKeys(rotatedFieldKeys, hierarchy.kek, newVersions)

      // Re-encrypt note content with new key
      const newNoteCryptoKey = await importKey(newNoteKey)
      const v2IV = generateIV()
      const v2AAD = new Uint8Array([1])
      const v2Ciphertext = await encrypt(plaintext, newNoteCryptoKey, { iv: v2IV, aad: v2AAD })

      // Old key cannot decrypt new ciphertext
      await expect(decrypt(v2Ciphertext, originalNoteCryptoKey, { iv: v2IV, aad: v2AAD })).rejects.toThrow(
        DecryptionError,
      )

      // New key decrypts correctly
      const decrypted = await decrypt(v2Ciphertext, newNoteCryptoKey, { iv: v2IV, aad: v2AAD })
      expect(new TextDecoder().decode(decrypted)).toBe('Sensitive note content')

      // Website/email keys unaffected
      const unwrapped = await unwrapFieldKeys(rotatedWrapped, hierarchy.kek)
      expect(unwrapped.get('website')).toEqual(fieldKeys.get('website'))
      expect(unwrapped.get('email')).toEqual(fieldKeys.get('email'))

      // Version rollback protection: unwrap v2 wrapped key with v1 AAD fails
      const v2WrappedNote = rotatedWrapped.find((k) => k.fieldName === 'note')!
      const tampered: WrappedFieldKey = { ...v2WrappedNote, version: 1 }
      await expect(unwrapFieldKeys([tampered], hierarchy.kek)).rejects.toThrow(DecryptionError)
    })
  })

  describe('performance', () => {
    it('registration flow completes within 5 seconds', async () => {
      const start = Date.now()
      await setupRegistration()
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(5000)
    })

    it('login flow completes within 5 seconds', async () => {
      const { authCreds, wrappedMasterKey, masterKeyIV, wrappedFieldKeys, authSalt, keySalt } =
        await setupRegistration()
      vi.clearAllMocks()

      vi.mocked(deriveAuthHash).mockResolvedValue(authCreds.authHash)
      vi.mocked(derivePasswordKey).mockResolvedValue(authCreds.passwordKey)

      const start = Date.now()
      const loginCreds = await deriveLoginCredentials(PASSWORD, authSalt, keySalt)
      const passwordCryptoKey = await importKey(loginCreds.passwordKey)
      const masterKey = await decrypt(wrappedMasterKey, passwordCryptoKey, {
        iv: masterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })
      const hierarchy = await deriveFullKeyHierarchy(masterKey)
      await unwrapFieldKeys(wrappedFieldKeys, hierarchy.kek)
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(5000)
    })
  })
})
