import { describe, it, expect, vi, beforeEach } from 'vitest'
import { encrypt, decrypt, importKey } from '@/shared/crypto/core/aes-gcm'
import { generateMasterKey, rewrapMasterKey } from '@/shared/crypto/keys/master-key'
import { generateAndWrapFieldKeys, unwrapFieldKeys } from '@/shared/crypto/keys/field-keys'
import { rotateFieldKeyCrypto } from '@/shared/crypto/keys/key-rotation'
import { deriveKEK } from '@/shared/crypto/core/hkdf'
import { deriveAuthCredentials, derivePasswordKey } from '@/shared/crypto/keys/split-kdf'
import { wrapMasterKeyWithRecovery, unwrapMasterKeyWithRecovery } from '@/shared/crypto/keys/mnemonic'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { FIELD_KEY_VERSION, MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import { hexEncode, hexDecode } from '@/shared/crypto/core/crypto-utils'
import type { ServerFieldKey, ServerMasterKeyEnvelope } from '@/shared/types/api.types'

// Mock Argon2id module — Web Worker won't run in jsdom
vi.mock('@/shared/crypto/core/argon2id', () => ({
  deriveKey: vi.fn(),
}))

// Mock split-kdf module — control derived values without Worker dependency
vi.mock('@/shared/crypto/keys/split-kdf', () => ({
  derivePasswordKey: vi.fn(),
  deriveAuthCredentials: vi.fn(),
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

import { deriveKey } from '@/shared/crypto/core/argon2id'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

// Mock crypto-utils module — allow generateSalt to be controlled per-test
vi.mock('@/shared/crypto/core/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/core/crypto-utils')),
  generateSalt: vi.fn(),
}))
import { generateKey, generateIV, encodeAAD, zeroFill, generateSalt } from '@/shared/crypto/core/crypto-utils'

const PASSWORD = 'test-password-123'
const PASSWORD_KEY_FILL = 0x11
const NEW_PASSWORD_KEY_FILL = 0x22
const RECOVERY_KEK_FILL = 0x33
const NUMBER_OF_FIELD_KEYS = 4

async function setupRegistration() {
  const kdfSalt = mockBytes(16, 0x01)
  vi.mocked(generateSalt).mockReturnValueOnce(kdfSalt)
  vi.mocked(deriveAuthCredentials).mockResolvedValue({
    authHash: 'a'.repeat(64),
    passwordKey: mockBytes(32, PASSWORD_KEY_FILL),
    kdfSalt,
  })

  const masterKey = generateMasterKey()
  const authCreds = await deriveAuthCredentials(PASSWORD, kdfSalt)
  const kekBytes = await deriveKEK(masterKey)
  const kek = await importKey(kekBytes)
  const { cryptoFieldKeys, wrappedFieldKeys } = await generateAndWrapFieldKeys(kek)
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
    cryptoFieldKeys,
    serverFieldKeys,
    wrappedMasterKey,
    masterKeyIV: iv,
    kdfSalt,
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
        cryptoFieldKeys,
        serverFieldKeys,
        wrappedMasterKey,
        masterKeyIV,
        authCreds,
        recoveryData,
      } = await setupRegistration()

      expect(masterKey.byteLength).toBe(32)
      expect(kek.type).toBe('secret')
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
      const { masterKey: recoveredMasterKey } = await unwrapMasterKeyWithRecovery(
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
      const { masterKey, authCreds, serverFieldKeys, wrappedMasterKey, masterKeyIV, kdfSalt } =
        await setupRegistration()
      vi.clearAllMocks()

      // Login derives both authHash and passwordKey from a single salt
      vi.mocked(deriveAuthCredentials).mockResolvedValue(authCreds)
      vi.mocked(derivePasswordKey).mockResolvedValue(authCreds.passwordKey)

      // deriveAuthCredentials with the kdfSalt returns the same credentials
      const loginCreds = await deriveAuthCredentials(PASSWORD, kdfSalt)
      expect(loginCreds.authHash).toBe(authCreds.authHash)
      expect(loginCreds.passwordKey).toEqual(authCreds.passwordKey)
      expect(generateSalt).not.toHaveBeenCalled()

      // derivePasswordKey for vault unlock
      const passwordKey = await derivePasswordKey(PASSWORD, hexEncode(kdfSalt))
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

      const newKdfSalt = mockBytes(16, 0xbb)
      // derivePasswordKey is called by rewrapMasterKey with the old password
      vi.mocked(derivePasswordKey).mockResolvedValueOnce(mockBytes(32, PASSWORD_KEY_FILL))
      // deriveAuthCredentials returns the new credentials for the new password
      vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
        authHash: 'b'.repeat(64),
        passwordKey: mockBytes(32, NEW_PASSWORD_KEY_FILL),
        kdfSalt: newKdfSalt,
      })
      vi.mocked(generateSalt).mockReturnValueOnce(newKdfSalt)

      const envelope: ServerMasterKeyEnvelope = {
        kdfSalt: hexEncode(authCreds.kdfSalt),
        wrappedMasterKey: hexEncode(wrappedMasterKey),
        masterKeyIV: hexEncode(masterKeyIV),
      }

      const result = await rewrapMasterKey(PASSWORD, 'new-password-456', envelope)

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
      const { masterKey: recoveredMasterKey } = await unwrapMasterKeyWithRecovery(
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
      const { kek, cryptoFieldKeys, serverFieldKeys } = await setupRegistration()
      vi.clearAllMocks()

      // Get original note CryptoKey for later comparison
      const originalNoteCryptoKey = cryptoFieldKeys.get('note')!
      const plaintext = new TextEncoder().encode('Sensitive note content')

      // Generate a new note key and wrap it directly with v2 AAD
      const newNoteKey = generateKey()
      const newNoteCryptoKey = await importKey(newNoteKey)
      const newNoteIV = generateIV()
      const newNoteAAD = encodeAAD('note', 2)
      const newNoteWrapped = await encrypt(newNoteKey, kek, { iv: newNoteIV, aad: newNoteAAD })
      zeroFill(newNoteKey)

      // Build server field keys: replace note key with rotated v2, keep others as‑is
      const rotatedServerFieldKeys: ServerFieldKey[] = [
        ...serverFieldKeys.filter((f) => f.fieldName !== 'note'),
        {
          fieldName: 'note',
          version: 2,
          wrappedFieldKey: hexEncode(newNoteWrapped),
          fieldKeyIV: hexEncode(newNoteIV),
        },
      ]

      // Re‑encrypt note content with new key
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
      const unwrapped = await unwrapFieldKeys(rotatedServerFieldKeys, kek)
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

      // Version rollback protection: v2 wrapped key with v1 AAD fails
      const tampered: ServerFieldKey = {
        fieldName: 'note',
        version: 1,
        wrappedFieldKey: hexEncode(newNoteWrapped),
        fieldKeyIV: hexEncode(newNoteIV),
      }
      await expect(unwrapFieldKeys([tampered], kek)).rejects.toThrow(DecryptionError)
    })

    it('rotateFieldKeyCrypto end-to-end unwraps the new key with the same KEK and round-trips all ciphertexts', async () => {
      const { kek, cryptoFieldKeys, serverFieldKeys } = await setupRegistration()
      vi.clearAllMocks()

      const oldNoteKey = cryptoFieldKeys.get('note')!
      const noteVersion = serverFieldKeys.find((f) => f.fieldName === 'note')!.version

      // Encrypt original note content with the content AAD rotateFieldKeyCrypto expects.
      const noteAad = encodeAAD('note', FIELD_KEY_VERSION)
      const entries = [
        { entryId: 'e1', plaintext: 'note one' },
        { entryId: 'e2', plaintext: 'note two' },
      ]
      const currentCiphertexts = await Promise.all(
        entries.map(async ({ entryId, plaintext }) => {
          const iv = generateIV()
          const cipher = await encrypt(new TextEncoder().encode(plaintext) as Uint8Array<ArrayBuffer>, oldNoteKey, {
            iv,
            aad: noteAad,
          })
          return { entryId, ciphertext: hexEncode(cipher), ciphertextIv: hexEncode(iv) }
        }),
      )

      const result = await rotateFieldKeyCrypto({
        kek,
        oldFieldKey: oldNoteKey,
        fieldName: 'note',
        currentVersion: noteVersion,
        currentCiphertexts,
      })

      expect(result.newVersion).toBe(noteVersion + 1)

      // The new wrapped key unwraps with the same KEK + new-version wrap AAD.
      const unwrappedRaw = await decrypt(hexDecode(result.newWrappedFieldKey), kek, {
        iv: hexDecode(result.newFieldKeyIv),
        aad: encodeAAD('note', result.newVersion),
      })
      const unwrappedKey = await importKey(unwrappedRaw)

      // Re-encrypted ciphertexts decrypt with the new key and match the originals.
      for (const r of result.reEncryptedFields) {
        const expected = entries.find((e) => e.entryId === r.entryId)!.plaintext
        const pt = await decrypt(hexDecode(r.ciphertext), unwrappedKey, {
          iv: hexDecode(r.ciphertextIv),
          aad: noteAad,
        })
        expect(new TextDecoder().decode(pt)).toBe(expected)
      }

      // The old note key can no longer decrypt the re-encrypted ciphertexts.
      for (const r of result.reEncryptedFields) {
        await expect(
          decrypt(hexDecode(r.ciphertext), oldNoteKey, { iv: hexDecode(r.ciphertextIv), aad: noteAad }),
        ).rejects.toThrow(DecryptionError)
      }

      // Other fields are untouched: their keys still round-trip their own content.
      const websiteKey = cryptoFieldKeys.get('website')!
      const websiteAad = encodeAAD('website', FIELD_KEY_VERSION)
      const wIv = generateIV()
      const wCipher = await encrypt(
        new TextEncoder().encode('website content') as Uint8Array<ArrayBuffer>,
        websiteKey,
        { iv: wIv, aad: websiteAad },
      )
      const wPt = await decrypt(wCipher, websiteKey, { iv: wIv, aad: websiteAad })
      expect(new TextDecoder().decode(wPt)).toBe('website content')
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
      const { authCreds, wrappedMasterKey, masterKeyIV, serverFieldKeys, kdfSalt } = await setupRegistration()
      vi.clearAllMocks()

      vi.mocked(derivePasswordKey).mockResolvedValue(authCreds.passwordKey)

      const start = Date.now()
      const passwordKey = await derivePasswordKey(PASSWORD, hexEncode(kdfSalt))
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
