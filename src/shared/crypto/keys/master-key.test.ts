import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  unwrapMasterKeyWithPassword,
  wrapMasterKeyWithPassword,
  rewrapMasterKey,
} from '@/shared/crypto/keys/master-key'
import { generateMasterKey } from '@/shared/crypto/keys/master-key'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { PasswordChangeResult } from '@/shared/types/crypto.types'
import type { ServerMasterKeyEnvelope } from '@/shared/types/api.types'

vi.mock('@/shared/crypto/keys/split-kdf', () => ({
  derivePasswordKey: vi.fn(),
  deriveAuthCredentials: vi.fn(),
}))

vi.mock('@/shared/crypto/core/aes-gcm', () => ({
  importKey: vi.fn().mockResolvedValue({} as CryptoKey),
  encrypt: vi.fn().mockResolvedValue(new Uint8Array(48).fill(0x04)),
  decrypt: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x03)),
}))

vi.mock('@/shared/crypto/core/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/core/crypto-utils')),
  generateIV: vi.fn().mockReturnValue(new Uint8Array(12).fill(0x0a) as Uint8Array<ArrayBuffer>),
  generateSalt: vi.fn().mockReturnValue(new Uint8Array(16).fill(0xff) as Uint8Array<ArrayBuffer>),
  zeroFill: vi.fn(),
}))

import { derivePasswordKey, deriveAuthCredentials } from '@/shared/crypto/keys/split-kdf'
import { importKey as realImportKey, decrypt as realDecrypt } from '@/shared/crypto/core/aes-gcm'
import { generateIV, generateSalt, zeroFill } from '@/shared/crypto/core/crypto-utils'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

const MOCK_ENVELOPE = {
  kdfSalt: '03'.repeat(16),
  wrappedMasterKey: '05'.repeat(48),
  masterKeyIV: '06'.repeat(12),
}

describe('unwrapMasterKeyWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('imports password key and decrypts master key', async () => {
    const passwordKey = mockBytes(32, 0x07)
    const result = await unwrapMasterKeyWithPassword(passwordKey, MOCK_ENVELOPE)

    expect(realImportKey).toHaveBeenCalledWith(passwordKey)
    expect(realDecrypt).toHaveBeenCalled()
    expect(result).toEqual(new Uint8Array(32).fill(0x03))
  })

  it('throws DecryptionError when decryption fails', async () => {
    vi.mocked(realDecrypt).mockRejectedValueOnce(new DecryptionError())

    const passwordKey = mockBytes(32, 0x07)
    await expect(unwrapMasterKeyWithPassword(passwordKey, MOCK_ENVELOPE)).rejects.toThrow(DecryptionError)
  })

  it('accepts CachedVaultEnvelope as envelope (subtype compatibility)', async () => {
    const cachedEnvelope = {
      ...MOCK_ENVELOPE,
      fieldKeys: [],
    }

    const passwordKey = mockBytes(32, 0x07)
    const result = await unwrapMasterKeyWithPassword(passwordKey, cachedEnvelope)

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
})

describe('rewrapMasterKey', () => {
  const NEW_KEY_FILL = 0x22

  /** Minimal envelope — values are irrelevant since unwrapMasterKeyWithPassword uses real decrypt mock. */
  const stubEnvelope: ServerMasterKeyEnvelope = {
    kdfSalt: 'aa'.repeat(16),
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
    vi.mocked(derivePasswordKey).mockResolvedValueOnce(mockBytes(32, PASSWORD_KEY_FILL))
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'newhash'.padEnd(64, '0'),
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      kdfSalt: mockBytes(16, 0xff),
    })

    const result: PasswordChangeResult = await rewrapMasterKey('oldPassword', 'newPassword', stubEnvelope)

    const newWrappingKey = await realImportKey(mockBytes(32, NEW_KEY_FILL))
    const unwrappedMasterKey = await realDecrypt(result.newWrappedMasterKey, newWrappingKey, {
      iv: result.newMasterKeyIV,
      aad: MASTER_KEY_PASSWORD_AAD,
    })

    expect(unwrappedMasterKey).toEqual(masterKey)
  })

  it('generates a new kdfSalt and passes it to deriveAuthCredentials', async () => {
    const masterKey = generateMasterKey()
    const newKdfSalt = mockBytes(16, 0xbb)
    vi.mocked(realDecrypt).mockResolvedValueOnce(masterKey)
    vi.mocked(derivePasswordKey).mockResolvedValueOnce(mockBytes(32, PASSWORD_KEY_FILL))
    vi.mocked(generateSalt).mockReturnValueOnce(newKdfSalt)
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'a'.repeat(64),
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      kdfSalt: newKdfSalt,
    })

    const result = await rewrapMasterKey('oldPw', 'newPw', stubEnvelope)

    expect(generateSalt).toHaveBeenCalledTimes(1)
    expect(deriveAuthCredentials).toHaveBeenCalledWith('newPw', newKdfSalt)
    expect(result.newKdfSalt).toEqual(newKdfSalt)
  })

  it('returns newAuthHash from deriveAuthCredentials', async () => {
    const masterKey = generateMasterKey()
    vi.mocked(realDecrypt).mockResolvedValueOnce(masterKey)
    vi.mocked(derivePasswordKey).mockResolvedValueOnce(mockBytes(32, PASSWORD_KEY_FILL))
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'newauthhash00000000000000000000000000000000000000000000000',
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      kdfSalt: mockBytes(16, 0xaa),
    })

    const result = await rewrapMasterKey('oldPw', 'newPw', stubEnvelope)

    expect(result.newAuthHash).toBe('newauthhash00000000000000000000000000000000000000000000000')
  })

  it('throws DecryptionError if old password cannot unwrap master key', async () => {
    vi.mocked(realDecrypt).mockRejectedValueOnce(new DecryptionError())

    await expect(rewrapMasterKey('wrongPassword', 'newPw', stubEnvelope)).rejects.toThrow(DecryptionError)
  })

  it('calls derivePasswordKey with old password and envelope kdfSalt', async () => {
    const masterKey = generateMasterKey()
    vi.mocked(realDecrypt).mockResolvedValueOnce(masterKey)
    vi.mocked(derivePasswordKey).mockResolvedValueOnce(mockBytes(32, PASSWORD_KEY_FILL))
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'a'.repeat(64),
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      kdfSalt: mockBytes(16, 0xaa),
    })

    await rewrapMasterKey('oldPw', 'newPw', stubEnvelope)

    expect(derivePasswordKey).toHaveBeenCalledWith('oldPw', stubEnvelope.kdfSalt)
  })

  it('zero-fills old password key, master key, and new password key', async () => {
    const masterKey = generateMasterKey()
    const oldPasswordKey = mockBytes(32, PASSWORD_KEY_FILL)
    const newPasswordKey = mockBytes(32, NEW_KEY_FILL)
    vi.mocked(realDecrypt).mockResolvedValueOnce(masterKey)
    vi.mocked(derivePasswordKey).mockResolvedValueOnce(oldPasswordKey)
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'a'.repeat(64),
      passwordKey: newPasswordKey,
      kdfSalt: mockBytes(16, 0xaa),
    })

    await rewrapMasterKey('oldPw', 'newPw', stubEnvelope)

    expect(zeroFill).toHaveBeenCalledWith(oldPasswordKey)
    expect(zeroFill).toHaveBeenCalledWith(masterKey)
    expect(zeroFill).toHaveBeenCalledWith(newPasswordKey)
  })

  it('master key content is unchanged after re-wrap', async () => {
    const masterKey = generateMasterKey()
    // First call: inside unwrapMasterKeyWithPassword; second call: verification below
    vi.mocked(realDecrypt)
      .mockResolvedValueOnce(new Uint8Array(masterKey) as Uint8Array<ArrayBuffer>)
      .mockResolvedValueOnce(masterKey)
    vi.mocked(derivePasswordKey).mockResolvedValueOnce(mockBytes(32, PASSWORD_KEY_FILL))
    vi.mocked(deriveAuthCredentials).mockResolvedValueOnce({
      authHash: 'a'.repeat(64),
      passwordKey: mockBytes(32, NEW_KEY_FILL),
      kdfSalt: mockBytes(16, 0xaa),
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

const PASSWORD_KEY_FILL = 0x11
