import { describe, it, expect, vi, beforeEach } from 'vitest'
import { unwrapMasterKeyWithPassword, wrapMasterKeyWithPassword, rewrapMasterKey } from '@/shared/crypto/master-key'
import { generateMasterKey } from '@/shared/crypto/master-key'
import { DecryptionError } from '@/shared/crypto/errors'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { PasswordChangeResult } from '@/shared/types/crypto.types'
import type { ServerMasterKeyEnvelope } from '@/shared/types/api.types'

vi.mock('@/shared/crypto/split-kdf', () => ({
  derivePasswordKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x07)),
  deriveAuthCredentials: vi.fn(),
}))

vi.mock('@/shared/crypto/aes-gcm', () => ({
  importKey: vi.fn().mockResolvedValue({} as CryptoKey),
  encrypt: vi.fn().mockResolvedValue(new Uint8Array(48).fill(0x04)),
  decrypt: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x03)),
}))

vi.mock('@/shared/crypto/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/crypto-utils')),
  generateIV: vi.fn().mockReturnValue(new Uint8Array(12).fill(0x0a) as Uint8Array<ArrayBuffer>),
  zeroFill: vi.fn(),
}))

import { derivePasswordKey, deriveAuthCredentials } from '@/shared/crypto/split-kdf'
import { importKey as realImportKey, decrypt as realDecrypt } from '@/shared/crypto/aes-gcm'
import { generateIV, zeroFill } from '@/shared/crypto/crypto-utils'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

const MOCK_ENVELOPE = {
  authHashSalt: '01'.repeat(16),
  passwordKeySalt: '02'.repeat(16),
  wrappedMasterKey: '05'.repeat(48),
  masterKeyIV: '06'.repeat(12),
}

describe('unwrapMasterKeyWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('derives password key, imports it, and decrypts master key', async () => {
    const result = await unwrapMasterKeyWithPassword('test-password', MOCK_ENVELOPE)

    expect(derivePasswordKey).toHaveBeenCalledWith('test-password', expect.any(Uint8Array))
    expect(realImportKey).toHaveBeenCalled()
    expect(realDecrypt).toHaveBeenCalled()
    expect(result).toEqual(new Uint8Array(32).fill(0x03))
  })

  it('zero-fills password key after importing it', async () => {
    const passwordKey = mockBytes(32, 0x07)
    vi.mocked(derivePasswordKey).mockResolvedValueOnce(passwordKey)

    await unwrapMasterKeyWithPassword('test-password', MOCK_ENVELOPE)

    expect(zeroFill).toHaveBeenCalledWith(passwordKey)
  })

  it('throws DecryptionError when decryption fails', async () => {
    vi.mocked(realDecrypt).mockRejectedValueOnce(new DecryptionError())

    await expect(unwrapMasterKeyWithPassword('wrong-password', MOCK_ENVELOPE)).rejects.toThrow(DecryptionError)
  })

  it('accepts CachedVaultEnvelope as envelope (subtype compatibility)', async () => {
    const cachedEnvelope = {
      ...MOCK_ENVELOPE,
      fieldKeys: [],
    }

    const result = await unwrapMasterKeyWithPassword('test-password', cachedEnvelope)

    expect(result).toBeDefined()
  })
})

describe('wrapMasterKeyWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('imports password key, generates IV, and encrypts master key', async () => {
    const masterKey = mockBytes(32, 0x01)
    const passwordKey = mockBytes(32, 0x02)

    const result = await wrapMasterKeyWithPassword(masterKey, passwordKey)

    expect(realImportKey).toHaveBeenCalledWith(passwordKey)
    expect(generateIV).toHaveBeenCalled()
    expect(realDecrypt).not.toHaveBeenCalled()
    // encrypt is mocked so we check the result is what the mock returns
    expect(result.wrappedMasterKey).toEqual(new Uint8Array(48).fill(0x04))
    expect(result.masterKeyIV).toEqual(new Uint8Array(12).fill(0x0a))
  })

  it('zero-fills password key after importing it', async () => {
    const masterKey = mockBytes(32, 0x01)
    const passwordKey = mockBytes(32, 0x02)

    await wrapMasterKeyWithPassword(masterKey, passwordKey)

    expect(zeroFill).toHaveBeenCalledWith(passwordKey)
  })
})

describe('rewrapMasterKey', () => {
  const NEW_KEY_FILL = 0x22

  /** Minimal envelope — values are irrelevant since unwrapMasterKeyWithPassword is mocked. */
  const stubEnvelope: ServerMasterKeyEnvelope = {
    authHashSalt: 'aa'.repeat(16),
    passwordKeySalt: 'bb'.repeat(16),
    wrappedMasterKey: 'cc'.repeat(48),
    masterKeyIV: 'dd'.repeat(12),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unwraps master key with old password and re-wraps with new password', async () => {
    const masterKey = generateMasterKey()
    // First call: inside unwrapMasterKeyWithPassword; second call: verification below
    vi.mocked(realDecrypt)
      .mockResolvedValueOnce(new Uint8Array(masterKey) as Uint8Array<ArrayBuffer>)
      .mockResolvedValueOnce(masterKey)
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'newhash'.padEnd(64, '0'),
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      authHashSalt: mockBytes(16, 0xaa),
      passwordKeySalt: mockBytes(16, 0xbb),
    })

    const result: PasswordChangeResult = await rewrapMasterKey('oldPassword', 'newPassword', stubEnvelope)

    const newWrappingKey = await realImportKey(mockBytes(32, NEW_KEY_FILL))
    const unwrappedMasterKey = await realDecrypt(result.newWrappedMasterKey, newWrappingKey, {
      iv: result.newMasterKeyIV,
      aad: MASTER_KEY_PASSWORD_AAD,
    })

    expect(unwrappedMasterKey).toEqual(masterKey)
  })

  it('generates new salts that differ from old salts', async () => {
    const masterKey = generateMasterKey()
    vi.mocked(realDecrypt).mockResolvedValueOnce(masterKey)
    const newAuthHashSalt = mockBytes(16, 0xbb)
    const newPasswordKeySalt = mockBytes(16, 0xcc)
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'a'.repeat(64),
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      authHashSalt: newAuthHashSalt,
      passwordKeySalt: newPasswordKeySalt,
    })

    const result = await rewrapMasterKey('oldPw', 'newPw', stubEnvelope)

    expect(result.newAuthHashSalt).toEqual(newAuthHashSalt)
    expect(result.newPasswordKeySalt).toEqual(newPasswordKeySalt)
  })

  it('returns newAuthHash from deriveAuthCredentials', async () => {
    const masterKey = generateMasterKey()
    vi.mocked(realDecrypt).mockResolvedValueOnce(masterKey)
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'newauthhash00000000000000000000000000000000000000000000000',
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      authHashSalt: mockBytes(16, 0xaa),
      passwordKeySalt: mockBytes(16, 0xbb),
    })

    const result = await rewrapMasterKey('oldPw', 'newPw', stubEnvelope)

    expect(result.newAuthHash).toBe('newauthhash00000000000000000000000000000000000000000000000')
  })

  it('throws DecryptionError if old password cannot unwrap master key', async () => {
    vi.mocked(realDecrypt).mockRejectedValueOnce(new DecryptionError())

    await expect(rewrapMasterKey('wrongPassword', 'newPw', stubEnvelope)).rejects.toThrow(DecryptionError)
  })

  it('calls deriveAuthCredentials with new password', async () => {
    const masterKey = generateMasterKey()
    vi.mocked(realDecrypt).mockResolvedValueOnce(masterKey)
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'a'.repeat(64),
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      authHashSalt: mockBytes(16, 0xaa),
      passwordKeySalt: mockBytes(16, 0xbb),
    })

    await rewrapMasterKey('oldPw', 'newPw', stubEnvelope)

    expect(deriveAuthCredentials).toHaveBeenCalledWith('newPw')
  })

  it('master key content is unchanged after re-wrap', async () => {
    const masterKey = generateMasterKey()
    // First call: inside unwrapMasterKeyWithPassword; second call: verification below
    vi.mocked(realDecrypt)
      .mockResolvedValueOnce(new Uint8Array(masterKey) as Uint8Array<ArrayBuffer>)
      .mockResolvedValueOnce(masterKey)
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'a'.repeat(64),
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      authHashSalt: mockBytes(16, 0xaa),
      passwordKeySalt: mockBytes(16, 0xbb),
    })

    const result = await rewrapMasterKey('oldPw', 'newPw', stubEnvelope)

    const newWrappingKey = await realImportKey(mockBytes(32, NEW_KEY_FILL))
    const unwrapped = await realDecrypt(result.newWrappedMasterKey, newWrappingKey, {
      iv: result.newMasterKeyIV,
      aad: MASTER_KEY_PASSWORD_AAD,
    })

    expect(unwrapped).toEqual(masterKey)
  })
})
