import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decrypt, encrypt, importKey } from '@/shared/crypto/aes-gcm'
import { unwrapFieldKeys } from '@/shared/crypto/key-hierarchy'
import { unwrapMasterKeyWithRecovery } from '@/shared/crypto/mnemonic'
import { FIELD_KEY_VERSION, MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { RegistrationResult } from '@/shared/types/crypto.types'
import type { ServerFieldKey } from '@/shared/types/api.types'
import { generateIV } from '@/shared/crypto/crypto-utils'
import { hexEncode } from '@/shared/crypto/crypto-utils'

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

// Mock crypto-utils module — allow generateSalt to be controlled per-test
vi.mock('@/shared/crypto/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/crypto-utils')),
  generateSalt: vi.fn(),
}))

import { deriveAuthHash, derivePasswordKey, deriveKey } from '@/shared/crypto/argon2id'
import { generateSalt } from '@/shared/crypto/crypto-utils'
import { deriveRegistrationKeys } from '@/features/auth/model/registration-crypto'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

const NUMBER_OF_FIELD_KEYS = 4
const PASSWORD = 'test-password-123'
const PASSWORD_KEY_FILL = 0x11
const RECOVERY_KEK_FILL = 0x33

describe('deriveRegistrationKeys', () => {
  let result: RegistrationResult

  beforeEach(async () => {
    vi.clearAllMocks()

    const authSalt = mockBytes(16, 0x01)
    const keySalt = mockBytes(16, 0x02)
    const recoverySalt = mockBytes(16, 0x03)
    vi.mocked(generateSalt).mockReturnValueOnce(authSalt).mockReturnValueOnce(keySalt).mockReturnValueOnce(recoverySalt)
    vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
    vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, PASSWORD_KEY_FILL))
    vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, RECOVERY_KEK_FILL))

    result = await deriveRegistrationKeys(PASSWORD)
  })

  it('returns authHash as 64-char hex string', () => {
    expect(result.authHash).toHaveLength(64)
    expect(result.authHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns 16-byte salts', () => {
    expect(result.authSalt).toHaveLength(16)
    expect(result.keySalt).toHaveLength(16)
  })

  it('returns wrappedMasterKey of 48 bytes and 12-byte IV', () => {
    expect(result.wrappedMasterKey).toHaveLength(48)
    expect(result.masterKeyIV).toHaveLength(12)
  })

  it('returns kek as CryptoKey', () => {
    expect(result.kek).toBeInstanceOf(CryptoKey)
  })

  it('returns fieldKeys map with 3 CryptoKey entries', () => {
    expect(result.fieldKeys.size).toBe(NUMBER_OF_FIELD_KEYS)
    expect(result.fieldKeys.get('note')).toBeInstanceOf(CryptoKey)
    expect(result.fieldKeys.get('website')).toBeInstanceOf(CryptoKey)
    expect(result.fieldKeys.get('email')).toBeInstanceOf(CryptoKey)
  })

  it('returns 3 wrapped field keys, all version 1', () => {
    expect(result.wrappedFieldKeys).toHaveLength(NUMBER_OF_FIELD_KEYS)
    for (const wfk of result.wrappedFieldKeys) {
      expect(wfk.version).toBe(FIELD_KEY_VERSION)
      expect(wfk.wrappedKey).toHaveLength(48)
      expect(wfk.iv).toHaveLength(12)
    }
  })

  it('returns recovery data with correct sizes', () => {
    expect(result.recoveryData.recoverySalt).toHaveLength(16)
    expect(result.recoveryData.wrappedMasterKey).toHaveLength(48)
    expect(result.recoveryData.recoveryIV).toHaveLength(12)
  })

  it('returns 12-word mnemonic', () => {
    expect(result.mnemonic.split(' ')).toHaveLength(12)
  })

  it('unwraps master key with password key', async () => {
    const passwordKey = mockBytes(32, PASSWORD_KEY_FILL)
    const cryptoKey = await importKey(passwordKey)
    const decrypted = await decrypt(result.wrappedMasterKey, cryptoKey, {
      iv: result.masterKeyIV,
      aad: MASTER_KEY_PASSWORD_AAD,
    })
    // Verify unwrapped key is 32 bytes (master key length)
    expect(decrypted).toHaveLength(32)
  })

  it('unwraps field keys with derived KEK', async () => {
    // Convert WrappedFieldKey[] to ServerFieldKey[] format (hex strings)
    const serverFieldKeys: ServerFieldKey[] = result.wrappedFieldKeys.map((wfk) => ({
      fieldName: wfk.fieldName,
      version: wfk.version,
      wrappedKey: hexEncode(wfk.wrappedKey),
      keyIV: hexEncode(wfk.iv),
    }))

    // unwrapFieldKeys now returns Map<string, CryptoKey>
    const unwrapped = await unwrapFieldKeys(serverFieldKeys, result.kek)

    // Verify unwrapped keys are CryptoKeys and can encrypt/decrypt correctly
    expect(unwrapped.size).toBe(NUMBER_OF_FIELD_KEYS)
    for (const [, cryptoKey] of unwrapped) {
      expect(cryptoKey).toBeInstanceOf(CryptoKey)

      // Verify key works via encrypt-decrypt round-trip
      const plaintext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const iv = generateIV()
      const aad = new Uint8Array([1])
      const ciphertext = await encrypt(plaintext, cryptoKey, { iv, aad })
      const decrypted = await decrypt(ciphertext, cryptoKey, { iv, aad })
      expect(decrypted).toEqual(plaintext)
    }
  })

  it('unwraps master key with recovery mnemonic', async () => {
    const masterKey = await unwrapMasterKeyWithRecovery(result.recoveryData.wrappedMasterKey, result.mnemonic, {
      iv: result.recoveryData.recoveryIV,
      salt: result.recoveryData.recoverySalt,
    })
    // Verify unwrapped key is 32 bytes (master key length)
    expect(masterKey).toHaveLength(32)

    // Verify key works by importing and doing encrypt-decrypt round-trip
    const cryptoKey = await importKey(masterKey)
    const plaintext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const iv = generateIV()
    const aad = new Uint8Array([2])
    const ciphertext = await encrypt(plaintext, cryptoKey, { iv, aad })
    const decrypted = await decrypt(ciphertext, cryptoKey, { iv, aad })
    expect(decrypted).toEqual(plaintext)
  })

  it('calls deriveAuthCredentials with password', () => {
    expect(deriveAuthHash).toHaveBeenCalledWith(PASSWORD, result.authSalt)
    expect(derivePasswordKey).toHaveBeenCalledWith(PASSWORD, result.keySalt)
  })
})
