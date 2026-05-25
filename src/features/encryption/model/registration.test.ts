import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decrypt, importKey } from '@/shared/crypto/aes-gcm'
import { unwrapFieldKeys } from '@/shared/crypto/key-hierarchy'
import { unwrapMasterKeyWithRecovery } from '@/shared/crypto/mnemonic'
import { FIELD_KEY_VERSION, MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { RegistrationResult } from '@/shared/types/crypto.types'

// Mock Argon2id module — Web Worker won't run in jsdom
vi.mock('@/shared/crypto/argon2id', () => ({
  deriveAuthHash: vi.fn(),
  derivePasswordKey: vi.fn(),
  deriveKey: vi.fn(),
  generateSalt: vi.fn(),
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

import { deriveAuthHash, derivePasswordKey, deriveKey, generateSalt } from '@/shared/crypto/argon2id'
import { deriveRegistrationKeys } from '@/features/encryption/model/registration'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

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

  it('returns 32-byte masterKey', () => {
    expect(result.masterKey).toHaveLength(32)
  })

  it('returns 32-byte kek (raw bytes, not CryptoKey)', () => {
    expect(result.kek).toHaveLength(32)
  })

  it('returns fieldKeys map with 3 entries, each 32 bytes', () => {
    expect(result.fieldKeys.size).toBe(3)
    expect(result.fieldKeys.get('note')).toHaveLength(32)
    expect(result.fieldKeys.get('website')).toHaveLength(32)
    expect(result.fieldKeys.get('email')).toHaveLength(32)
  })

  it('returns 3 wrapped field keys, all version 1', () => {
    expect(result.wrappedFieldKeys).toHaveLength(3)
    for (const wfk of result.wrappedFieldKeys) {
      expect(wfk.version).toBe(FIELD_KEY_VERSION)
      expect(wfk.wrappedKey).toHaveLength(48)
      expect(wfk.iv).toHaveLength(12)
    }
  })

  it('returns wrapped master key of 48 bytes and 12-byte IV', () => {
    expect(result.wrappedMasterKey).toHaveLength(48)
    expect(result.masterKeyIV).toHaveLength(12)
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
    const decrypted = await decrypt(result.wrappedMasterKey, cryptoKey, result.masterKeyIV, MASTER_KEY_PASSWORD_AAD)
    expect(decrypted).toEqual(result.masterKey)
  })

  it('unwraps field keys with derived KEK', async () => {
    const kekCryptoKey = await importKey(result.kek)
    const unwrapped = await unwrapFieldKeys(result.wrappedFieldKeys, kekCryptoKey)
    for (const [name, key] of result.fieldKeys) {
      expect(unwrapped.get(name)).toEqual(key)
    }
  })

  it('unwraps master key with recovery mnemonic', async () => {
    const masterKey = await unwrapMasterKeyWithRecovery(
      result.recoveryData.wrappedMasterKey,
      result.mnemonic,
      result.recoveryData.recoverySalt,
      result.recoveryData.recoveryIV,
    )
    expect(masterKey).toEqual(result.masterKey)
  })

  it('calls deriveAuthCredentials with password', () => {
    expect(deriveAuthHash).toHaveBeenCalledWith(PASSWORD, result.authSalt)
    expect(derivePasswordKey).toHaveBeenCalledWith(PASSWORD, result.keySalt)
  })
})
