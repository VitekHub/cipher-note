import { describe, it, expect, vi, beforeEach } from 'vitest'
import { encrypt, decrypt, importKey } from '@/shared/crypto/aes-gcm'
import { generateMasterKey } from '@/shared/crypto/master-key'
import { generateFieldKeys, wrapFieldKeys, unwrapFieldKeys } from '@/shared/crypto/field-keys'
import { deriveKEK } from '@/shared/crypto/hkdf'
import { deriveAuthCredentials, changePassword } from '@/shared/crypto/split-kdf'
import { wrapMasterKeyWithRecovery, unwrapMasterKeyWithRecovery } from '@/shared/crypto/mnemonic'
import { DecryptionError } from '@/shared/crypto/errors'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import { hexEncode } from '@/shared/crypto/crypto-utils'
import type { WrappedFieldKey } from '@/shared/types/crypto.types'
import type { ServerFieldKey, ServerMasterKeyEnvelope } from '../types/api.types'

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
const NUMBER_OF_FIELD_KEYS = 4

async function setupRegistration() {
  const authHashSalt = mockBytes(16, 0x01)
  const passwordKeySalt = mockBytes(16, 0x02)
  vi.mocked(generateSalt).mockReturnValueOnce(authHashSalt).mockReturnValueOnce(passwordKeySalt)
  vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
  vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, PASSWORD_KEY_FILL))

  const masterKey = generateMasterKey()
  const authCreds = await deriveAuthCredentials(PASSWORD)
  const kekBytes = await deriveKEK(masterKey)
  const kek = await importKey(kekBytes)
  const { rawFieldKeys, cryptoFieldKeys } = await generateFieldKeys()
  const versions = new Map([
    ['note', 1],
    ['website', 1],
    ['email', 1],
    ['title', 1],
  ])
  const wrappedFieldKeys = await wrapFieldKeys(rawFieldKeys, kek, versions)
  const serverFieldKeys: ServerFieldKey[] = wrappedFieldKeys.map((w) => ({
    fieldName: w.fieldName,
    version: w.version,
    wrappedFieldKey: hexEncode(w.wrappedFieldKey),
    fieldKeyIV: hexEncode(w.fieldKeyIV),
  }))

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
    kek,
    rawFieldKeys,
    cryptoFieldKeys,
    wrappedFieldKeys,
    serverFieldKeys,
    wrappedMasterKey,
    masterKeyIV: iv,
    authHashSalt,
    passwordKeySalt,
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
        kek,
        rawFieldKeys,
        cryptoFieldKeys,
        serverFieldKeys,
        wrappedMasterKey,
        masterKeyIV,
        authCreds,
        recoveryData,
      } = await setupRegistration()

      expect(masterKey.byteLength).toBe(32)
      expect(kek.type).toBe('secret')
      expect(rawFieldKeys.size).toBe(NUMBER_OF_FIELD_KEYS)
      expect(cryptoFieldKeys.size).toBe(NUMBER_OF_FIELD_KEYS)
      expect(serverFieldKeys).toHaveLength(NUMBER_OF_FIELD_KEYS)

      // Unwrap field keys - returns Map<string, CryptoKey>, verify via round-trip
      const unwrappedFieldKeys = await unwrapFieldKeys(serverFieldKeys, kek)
      for (const name of ['note', 'website', 'email']) {
        const cryptoKey = unwrappedFieldKeys.get(name)!
        const plaintext = new Uint8Array([0x42])
        const iv = generateIV()
        const aad = new Uint8Array([1])
        const ciphertext = await encrypt(plaintext, cryptoKey, { iv, aad })
        const decrypted = await decrypt(ciphertext, cryptoKey, { iv, aad })
        expect(decrypted).toEqual(plaintext)
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
      const recoveredMasterKey = await unwrapMasterKeyWithRecovery(
        recoveryData.recoveryWrappedMasterKey,
        MOCK_VALID_MNEMONIC,
        {
          iv: recoveryData.recoveryKeyIV,
          salt: recoveryData.recoveryKeySalt,
        },
      )
      expect(recoveredMasterKey).toEqual(masterKey)
    })
  })

  describe('login flow', () => {
    it('recovers all keys from stored server data', async () => {
      const { masterKey, authCreds, serverFieldKeys, wrappedMasterKey, masterKeyIV, authHashSalt, passwordKeySalt } =
        await setupRegistration()
      vi.clearAllMocks()

      vi.mocked(deriveAuthHash).mockResolvedValue(authCreds.authHash)
      vi.mocked(derivePasswordKey).mockResolvedValue(authCreds.passwordKey)

      // Login now uses deriveAuthHash + derivePasswordKey
      const authHash = await deriveAuthHash(PASSWORD, authHashSalt)
      const passwordKey = await derivePasswordKey(PASSWORD, passwordKeySalt)
      expect(authHash).toBe(authCreds.authHash)
      expect(passwordKey).toEqual(authCreds.passwordKey)
      expect(generateSalt).not.toHaveBeenCalled()

      // Manual KEK derivation: importKey(passwordKey) -> decrypt(wrappedMasterKey) -> deriveKEK(masterKey) -> importKey(kekBytes)
      const passwordCryptoKey = await importKey(passwordKey)
      const unwrappedMasterKey = await decrypt(wrappedMasterKey, passwordCryptoKey, {
        iv: masterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })
      expect(unwrappedMasterKey).toEqual(masterKey)

      const kekBytes = await deriveKEK(unwrappedMasterKey)
      const kek = await importKey(kekBytes)
      // unwrapFieldKeys now takes ServerFieldKey[], returns Map<string, CryptoKey>
      const unwrappedFieldKeys = await unwrapFieldKeys(serverFieldKeys, kek)
      // Compare CryptoKey results via encrypt/decrypt round-trip
      for (const name of ['note', 'website', 'email']) {
        const cryptoKey = unwrappedFieldKeys.get(name)!
        const plaintext = new Uint8Array([0x42])
        const iv = generateIV()
        const aad = new Uint8Array([1])
        const ciphertext = await encrypt(plaintext, cryptoKey, { iv, aad })
        const decrypted = await decrypt(ciphertext, cryptoKey, { iv, aad })
        expect(decrypted).toEqual(plaintext)
      }

      // Decrypt actual field content
      const noteCryptoKey = unwrappedFieldKeys.get('note')!
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
      const { masterKey, kek, serverFieldKeys, wrappedMasterKey, masterKeyIV, authCreds } = await setupRegistration()
      vi.clearAllMocks()

      const newAuthHashSalt = mockBytes(16, 0xbb)
      const newPasswordKeySalt = mockBytes(16, 0xcc)
      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, PASSWORD_KEY_FILL))
        .mockImplementationOnce(async () => mockBytes(32, NEW_PASSWORD_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('b'.repeat(64))
      vi.mocked(generateSalt).mockReturnValueOnce(newAuthHashSalt).mockReturnValueOnce(newPasswordKeySalt)

      const envelope: ServerMasterKeyEnvelope = {
        authHashSalt: hexEncode(authCreds.authHashSalt),
        passwordKeySalt: hexEncode(authCreds.passwordKeySalt),
        wrappedMasterKey: hexEncode(wrappedMasterKey),
        masterKeyIV: hexEncode(masterKeyIV),
      }

      const result = await changePassword(PASSWORD, 'new-password-456', envelope)

      const newCryptoKey = await importKey(mockBytes(32, NEW_PASSWORD_KEY_FILL))
      const unwrapped = await decrypt(result.newWrappedMasterKey, newCryptoKey, {
        iv: result.newMasterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })
      expect(unwrapped).toEqual(masterKey)

      // Field keys still decryptable with same KEK - unwrapFieldKeys returns Map<string, CryptoKey>
      const unwrappedFieldKeys = await unwrapFieldKeys(serverFieldKeys, kek)
      for (const name of ['note', 'website', 'email']) {
        const cryptoKey = unwrappedFieldKeys.get(name)!
        const plaintext = new Uint8Array([0x42])
        const iv = generateIV()
        const aad = new Uint8Array([1])
        const ciphertext = await encrypt(plaintext, cryptoKey, { iv, aad })
        const decrypted = await decrypt(ciphertext, cryptoKey, { iv, aad })
        expect(decrypted).toEqual(plaintext)
      }

      // Field content survives password change
      const noteCryptoKey = unwrappedFieldKeys.get('note')!
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
      const { masterKey, serverFieldKeys, recoveryData } = await setupRegistration()
      vi.clearAllMocks()

      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, RECOVERY_KEK_FILL))
      const recoveredMasterKey = await unwrapMasterKeyWithRecovery(
        recoveryData.recoveryWrappedMasterKey,
        MOCK_VALID_MNEMONIC,
        {
          iv: recoveryData.recoveryKeyIV,
          salt: recoveryData.recoveryKeySalt,
        },
      )
      expect(recoveredMasterKey).toEqual(masterKey)

      const recoveredKekBytes = await deriveKEK(recoveredMasterKey)
      const recoveredKek = await importKey(recoveredKekBytes)
      // unwrapFieldKeys returns Map<string, CryptoKey> — verify via encrypt/decrypt round-trip
      const recoveredFieldKeys = await unwrapFieldKeys(serverFieldKeys, recoveredKek)
      for (const name of ['note', 'website', 'email']) {
        const cryptoKey = recoveredFieldKeys.get(name)!
        const plaintext = new Uint8Array([0x42])
        const iv = generateIV()
        const aad = new Uint8Array([1])
        const ciphertext = await encrypt(plaintext, cryptoKey, { iv, aad })
        const decrypted = await decrypt(ciphertext, cryptoKey, { iv, aad })
        expect(decrypted).toEqual(plaintext)
      }

      // Decrypt all field content
      for (const name of ['note', 'website', 'email']) {
        const cryptoKey = recoveredFieldKeys.get(name)!
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
        unwrapMasterKeyWithRecovery(recoveryData.recoveryWrappedMasterKey, 'wrong mnemonic here', {
          iv: recoveryData.recoveryKeyIV,
          salt: recoveryData.recoveryKeySalt,
        }),
      ).rejects.toThrow(DecryptionError)
    })
  })

  describe('key rotation', () => {
    it('rotates one field key without affecting others', async () => {
      const { kek, rawFieldKeys } = await setupRegistration()
      vi.clearAllMocks()

      // Import original v1 key for later comparison
      const originalNoteKey = rawFieldKeys.get('note')!
      const originalNoteCryptoKey = await importKey(originalNoteKey)
      const plaintext = new TextEncoder().encode('Sensitive note content')

      // Rotate note key to v2
      const newNoteKey = crypto.getRandomValues(new Uint8Array(32)) as Uint8Array<ArrayBuffer>
      expect(newNoteKey).not.toEqual(originalNoteKey)

      const rotatedFieldKeys = new Map(rawFieldKeys)
      rotatedFieldKeys.set('note', newNoteKey)
      const newVersions = new Map([
        ['note', 2],
        ['website', 1],
        ['email', 1],
        ['title', 1],
      ])
      const rotatedWrapped = await wrapFieldKeys(rotatedFieldKeys, kek, newVersions)
      const rotatedServerFieldKeys: ServerFieldKey[] = rotatedWrapped.map((w) => ({
        fieldName: w.fieldName,
        version: w.version,
        wrappedFieldKey: hexEncode(w.wrappedFieldKey),
        fieldKeyIV: hexEncode(w.fieldKeyIV),
      }))

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

      // Website/email keys unaffected - unwrapFieldKeys returns Map<string, CryptoKey>
      const unwrapped = await unwrapFieldKeys(rotatedServerFieldKeys, kek)
      // Verify via round-trip since we can't compare CryptoKey directly
      const websiteCryptoKey = unwrapped.get('website')!
      const emailCryptoKey = unwrapped.get('email')!
      const websitePlaintext = new Uint8Array([0x42])
      const emailPlaintext = new Uint8Array([0x43])
      const iv = generateIV()
      const aad = new Uint8Array([1])
      const websiteCiphertext = await encrypt(websitePlaintext, websiteCryptoKey, { iv, aad })
      const emailCiphertext = await encrypt(emailPlaintext, emailCryptoKey, { iv, aad })
      expect(await decrypt(websiteCiphertext, websiteCryptoKey, { iv, aad })).toEqual(websitePlaintext)
      expect(await decrypt(emailCiphertext, emailCryptoKey, { iv, aad })).toEqual(emailPlaintext)

      // Version rollback protection: unwrap v2 wrapped key with v1 AAD fails
      const v2WrappedNote = rotatedWrapped.find((k) => k.fieldName === 'note')!
      const tampered: WrappedFieldKey = { ...v2WrappedNote, version: 1 }
      const tamperedServer: ServerFieldKey = {
        fieldName: tampered.fieldName,
        version: tampered.version,
        wrappedFieldKey: hexEncode(tampered.wrappedFieldKey),
        fieldKeyIV: hexEncode(tampered.fieldKeyIV),
      }
      await expect(unwrapFieldKeys([tamperedServer], kek)).rejects.toThrow(DecryptionError)
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
      const { authCreds, wrappedMasterKey, masterKeyIV, serverFieldKeys, passwordKeySalt } = await setupRegistration()
      vi.clearAllMocks()

      vi.mocked(deriveAuthHash).mockResolvedValue(authCreds.authHash)
      vi.mocked(derivePasswordKey).mockResolvedValue(authCreds.passwordKey)

      const start = Date.now()
      const passwordKey = await derivePasswordKey(PASSWORD, passwordKeySalt)
      const passwordCryptoKey = await importKey(passwordKey)
      const masterKey = await decrypt(wrappedMasterKey, passwordCryptoKey, {
        iv: masterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })
      const kekBytes = await deriveKEK(masterKey)
      const kek = await importKey(kekBytes)
      await unwrapFieldKeys(serverFieldKeys, kek)
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(5000)
    })
  })
})
