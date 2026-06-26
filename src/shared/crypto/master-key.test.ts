import { describe, it, expect, vi, beforeEach } from 'vitest'
import { unwrapMasterKeyWithPassword, wrapMasterKeyWithPassword } from '@/shared/crypto/master-key'
import { DecryptionError } from '@/shared/crypto/errors'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'

vi.mock('@/shared/crypto/argon2id', () => ({
  derivePasswordKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x07)),
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

import { derivePasswordKey } from '@/shared/crypto/argon2id'
import { importKey, encrypt, decrypt } from '@/shared/crypto/aes-gcm'
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
    expect(importKey).toHaveBeenCalled()
    expect(decrypt).toHaveBeenCalled()
    expect(result).toEqual(new Uint8Array(32).fill(0x03))
  })

  it('zero-fills password key after importing it', async () => {
    const passwordKey = mockBytes(32, 0x07)
    vi.mocked(derivePasswordKey).mockResolvedValueOnce(passwordKey)

    await unwrapMasterKeyWithPassword('test-password', MOCK_ENVELOPE)

    expect(zeroFill).toHaveBeenCalledWith(passwordKey)
  })

  it('throws DecryptionError when decryption fails', async () => {
    vi.mocked(decrypt).mockRejectedValueOnce(new DecryptionError())

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

    expect(importKey).toHaveBeenCalledWith(passwordKey)
    expect(generateIV).toHaveBeenCalled()
    expect(encrypt).toHaveBeenCalledWith(masterKey, expect.any(Object), {
      iv: expect.any(Uint8Array),
      aad: MASTER_KEY_PASSWORD_AAD,
    })
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
