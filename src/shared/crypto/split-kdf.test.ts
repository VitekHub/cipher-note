import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DecryptionError } from '@/shared/crypto/errors'
import { deriveAuthCredentials, changePassword } from '@/shared/crypto/split-kdf'
import { importKey, decrypt } from '@/shared/crypto/aes-gcm'
import { generateMasterKey } from '@/shared/crypto/key-hierarchy'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { AuthCredentials, PasswordChangeResult } from '@/shared/types/crypto.types'
import type { ServerMasterKeyEnvelope } from '@/shared/types/api.types'

// Mock Argon2id module to avoid WASM/worker dependency in tests
vi.mock('@/shared/crypto/argon2id', () => ({
  deriveAuthHash: vi.fn(),
  derivePasswordKey: vi.fn(),
}))

// Mock master-key module — unwrap is mocked (returns controlled values), wrap uses real impl
vi.mock('@/shared/crypto/master-key', async () => ({
  ...(await vi.importActual('@/shared/crypto/master-key')),
  unwrapMasterKeyWithPassword: vi.fn(),
}))

import { deriveAuthHash, derivePasswordKey } from '@/shared/crypto/argon2id'
import { unwrapMasterKeyWithPassword } from '@/shared/crypto/master-key'

// Mock crypto-utils module — allow generateSalt to be controlled per-test
vi.mock('@/shared/crypto/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/crypto-utils')),
  generateSalt: vi.fn(),
}))
import { generateSalt } from '@/shared/crypto/crypto-utils'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

describe('split-kdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deriveAuthCredentials', () => {
    it('generates two salts and derives authHash and passwordKey in parallel', async () => {
      const authSalt = mockBytes(16, 0x01)
      const keySalt = mockBytes(16, 0x02)
      vi.mocked(generateSalt).mockReturnValueOnce(authSalt).mockReturnValueOnce(keySalt)
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, 0xab))

      const result = await deriveAuthCredentials('password123')

      expect(generateSalt).toHaveBeenCalledTimes(2)
      expect(deriveAuthHash).toHaveBeenCalledWith('password123', authSalt)
      expect(derivePasswordKey).toHaveBeenCalledWith('password123', keySalt)
      expect(result).toEqual({
        authHash: 'a'.repeat(64),
        passwordKey: mockBytes(32, 0xab),
        authSalt,
        keySalt,
      })
    })

    it('returns AuthCredentials with correct types', async () => {
      vi.mocked(generateSalt).mockReturnValue(mockBytes(16, 0x01))
      vi.mocked(deriveAuthHash).mockResolvedValue('b'.repeat(64))
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, 0xcd))

      const result: AuthCredentials = await deriveAuthCredentials('test')

      expect(typeof result.authHash).toBe('string')
      expect(result.authHash).toHaveLength(64)
      expect(result.passwordKey).toBeInstanceOf(Uint8Array)
      expect(result.passwordKey.byteLength).toBe(32)
      expect(result.authSalt).toBeInstanceOf(Uint8Array)
      expect(result.authSalt.byteLength).toBe(16)
      expect(result.keySalt).toBeInstanceOf(Uint8Array)
      expect(result.keySalt.byteLength).toBe(16)
    })
  })

  describe('changePassword', () => {
    const NEW_KEY_FILL = 0x22

    /** Minimal envelope — values are irrelevant since unwrapMasterKeyWithPassword is mocked. */
    const stubEnvelope: ServerMasterKeyEnvelope = {
      authSalt: 'aa'.repeat(16),
      keySalt: 'bb'.repeat(16),
      wrappedMasterKey: 'cc'.repeat(48),
      masterKeyIV: 'dd'.repeat(12),
    }

    it('unwraps master key with old password and re-wraps with new password', async () => {
      const masterKey = generateMasterKey()
      // Pass a copy so zeroFill inside changePassword doesn't zero the reference we compare against
      vi.mocked(unwrapMasterKeyWithPassword).mockResolvedValueOnce(new Uint8Array(masterKey) as Uint8Array<ArrayBuffer>)
      vi.mocked(derivePasswordKey).mockImplementationOnce(async () => mockBytes(32, NEW_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('newhash'.padEnd(64, '0'))

      const result: PasswordChangeResult = await changePassword('oldPassword', 'newPassword', stubEnvelope)

      const newWrappingKey = await importKey(mockBytes(32, NEW_KEY_FILL))
      const unwrappedMasterKey = await decrypt(result.newWrappedMasterKey, newWrappingKey, {
        iv: result.newMasterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })

      expect(unwrappedMasterKey).toEqual(masterKey)
    })

    it('generates new salts that differ from old salts', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(unwrapMasterKeyWithPassword).mockResolvedValueOnce(masterKey)
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, NEW_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))

      const newAuthSalt = mockBytes(16, 0xbb)
      const newKeySalt = mockBytes(16, 0xcc)
      vi.mocked(generateSalt).mockReturnValueOnce(newAuthSalt).mockReturnValueOnce(newKeySalt)

      const result = await changePassword('oldPw', 'newPw', stubEnvelope)

      expect(result.newAuthSalt).toEqual(newAuthSalt)
      expect(result.newKeySalt).toEqual(newKeySalt)
    })

    it('returns newAuthHash from deriveAuthHash', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(unwrapMasterKeyWithPassword).mockResolvedValueOnce(masterKey)
      vi.mocked(derivePasswordKey).mockImplementationOnce(async () => mockBytes(32, NEW_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('newauthhash00000000000000000000000000000000000000000000000')

      vi.mocked(generateSalt).mockReturnValueOnce(mockBytes(16, 0xaa)).mockReturnValueOnce(mockBytes(16, 0xbb))

      const result = await changePassword('oldPw', 'newPw', stubEnvelope)

      expect(result.newAuthHash).toBe('newauthhash00000000000000000000000000000000000000000000000')
    })

    it('throws DecryptionError if old password cannot unwrap master key', async () => {
      vi.mocked(unwrapMasterKeyWithPassword).mockRejectedValueOnce(new DecryptionError())

      await expect(changePassword('wrongPassword', 'newPw', stubEnvelope)).rejects.toThrow(DecryptionError)
    })

    it('calls generateSalt twice for new salts', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(unwrapMasterKeyWithPassword).mockResolvedValueOnce(masterKey)
      vi.mocked(derivePasswordKey).mockImplementationOnce(async () => mockBytes(32, NEW_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
      vi.mocked(generateSalt).mockReturnValueOnce(mockBytes(16, 0xaa)).mockReturnValueOnce(mockBytes(16, 0xbb))

      await changePassword('oldPw', 'newPw', stubEnvelope)

      expect(generateSalt).toHaveBeenCalledTimes(2)
    })

    it('master key content is unchanged after re-wrap', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(unwrapMasterKeyWithPassword).mockResolvedValueOnce(new Uint8Array(masterKey) as Uint8Array<ArrayBuffer>)
      vi.mocked(unwrapMasterKeyWithPassword).mockResolvedValueOnce(masterKey)
      vi.mocked(derivePasswordKey).mockImplementationOnce(async () => mockBytes(32, NEW_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
      vi.mocked(generateSalt).mockReturnValueOnce(mockBytes(16, 0xaa)).mockReturnValueOnce(mockBytes(16, 0xbb))

      const result = await changePassword('oldPw', 'newPw', stubEnvelope)

      const newWrappingKey = await importKey(mockBytes(32, NEW_KEY_FILL))
      const unwrapped = await decrypt(result.newWrappedMasterKey, newWrappingKey, {
        iv: result.newMasterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })

      expect(unwrapped).toEqual(masterKey)
    })
  })
})
