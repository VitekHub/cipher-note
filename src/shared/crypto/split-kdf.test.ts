import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DecryptionError } from '@/shared/crypto/errors'
import { deriveAuthCredentials, deriveLoginCredentials, changePassword } from '@/shared/crypto/split-kdf'
import { importKey, encrypt, decrypt, generateIV } from '@/shared/crypto/aes-gcm'
import { generateMasterKey } from '@/shared/crypto/key-hierarchy'
import type { AuthCredentials, LoginCredentials, PasswordChangeResult } from '@/shared/types/crypto.types'

// Mock Argon2id module to avoid WASM/worker dependency in tests
vi.mock('@/shared/crypto/argon2id', () => ({
  deriveAuthHash: vi.fn(),
  derivePasswordKey: vi.fn(),
  generateSalt: vi.fn(),
}))

import { deriveAuthHash, derivePasswordKey, generateSalt } from '@/shared/crypto/argon2id'

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

  describe('deriveLoginCredentials', () => {
    it('derives authHash and passwordKey from existing salts', async () => {
      const authSalt = mockBytes(16, 0x11)
      const keySalt = mockBytes(16, 0x22)
      vi.mocked(deriveAuthHash).mockResolvedValue('c'.repeat(64))
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, 0xef))

      const result: LoginCredentials = await deriveLoginCredentials('password123', authSalt, keySalt)

      expect(deriveAuthHash).toHaveBeenCalledWith('password123', authSalt)
      expect(derivePasswordKey).toHaveBeenCalledWith('password123', keySalt)
      expect(result).toEqual({
        authHash: 'c'.repeat(64),
        passwordKey: mockBytes(32, 0xef),
      })
    })

    it('does not generate new salts', async () => {
      const authSalt = mockBytes(16, 0x11)
      const keySalt = mockBytes(16, 0x22)
      vi.mocked(deriveAuthHash).mockResolvedValue('d'.repeat(64))
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, 0xff))

      await deriveLoginCredentials('password', authSalt, keySalt)

      expect(generateSalt).not.toHaveBeenCalled()
    })

    it('matches deriveAuthCredentials output for same password and salts', async () => {
      const authSalt = mockBytes(16, 0x01)
      const keySalt = mockBytes(16, 0x02)

      vi.mocked(generateSalt).mockReturnValueOnce(authSalt).mockReturnValueOnce(keySalt)
      vi.mocked(deriveAuthHash).mockResolvedValue('e'.repeat(64))
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, 0xaa))

      const regResult = await deriveAuthCredentials('password123')

      vi.mocked(deriveAuthHash).mockResolvedValue('e'.repeat(64))
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, 0xaa))

      const loginResult = await deriveLoginCredentials('password123', regResult.authSalt, regResult.keySalt)

      expect(loginResult.authHash).toBe(regResult.authHash)
      expect(loginResult.passwordKey).toEqual(regResult.passwordKey)
    })
  })

  describe('changePassword', () => {
    // Use real AES-GCM for wrapping/unwrapping since changePassword
    // composes real crypto operations on the master key.

    it('unwraps master key with old password and re-wraps with new password', async () => {
      const masterKey = generateMasterKey()

      // Mock Argon2id to return different keys for old vs new password
      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, 0x11)) // old password key
        .mockImplementationOnce(async () => mockBytes(32, 0x22)) // new password key
      vi.mocked(deriveAuthHash).mockResolvedValue('newhash'.padEnd(64, '0'))

      // Wrap master key with old password key using real AES-GCM (no AAD)
      const oldWrappingKey = await importKey(mockBytes(32, 0x11))
      const oldIV = generateIV()
      const { ciphertext: wrappedMasterKey } = await encrypt(masterKey, oldWrappingKey, oldIV)

      const keySalt = mockBytes(16, 0x02)

      const result: PasswordChangeResult = await changePassword(
        'oldPassword',
        'newPassword',
        keySalt,
        wrappedMasterKey,
        oldIV,
      )

      // Verify the re-wrapped master key can be unwrapped with the new password key
      const newWrappingKey = await importKey(mockBytes(32, 0x22))
      const unwrappedMasterKey = await decrypt(result.newWrappedMasterKey, newWrappingKey, result.newMasterKeyIV)

      expect(unwrappedMasterKey).toEqual(masterKey)
    })

    it('generates new salts that differ from old salts', async () => {
      const masterKey = generateMasterKey()

      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, 0x11))
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))

      const newAuthSalt = mockBytes(16, 0xbb)
      const newKeySalt = mockBytes(16, 0xcc)
      vi.mocked(generateSalt).mockReturnValueOnce(newAuthSalt).mockReturnValueOnce(newKeySalt)

      const oldWrappingKey = await importKey(mockBytes(32, 0x11))
      const oldIV = generateIV()
      const { ciphertext: wrappedMasterKey } = await encrypt(masterKey, oldWrappingKey, oldIV)

      const keySalt = mockBytes(16, 0x02)

      const result = await changePassword('oldPw', 'newPw', keySalt, wrappedMasterKey, oldIV)

      expect(result.newAuthSalt).toEqual(newAuthSalt)
      expect(result.newKeySalt).toEqual(newKeySalt)
      expect(result.newAuthSalt).toEqual(newAuthSalt)
      expect(result.newKeySalt).toEqual(newKeySalt)
    })

    it('returns newAuthHash from deriveAuthHash', async () => {
      const masterKey = generateMasterKey()

      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, 0x11))
        .mockImplementationOnce(async () => mockBytes(32, 0x22))
      vi.mocked(deriveAuthHash).mockResolvedValue('newauthhash00000000000000000000000000000000000000000000000')

      const newAuthSalt = mockBytes(16, 0xaa)
      const newKeySalt = mockBytes(16, 0xbb)
      vi.mocked(generateSalt).mockReturnValueOnce(newAuthSalt).mockReturnValueOnce(newKeySalt)

      const oldWrappingKey = await importKey(mockBytes(32, 0x11))
      const oldIV = generateIV()
      const { ciphertext: wrappedMasterKey } = await encrypt(masterKey, oldWrappingKey, oldIV)

      const result = await changePassword('oldPw', 'newPw', mockBytes(16, 0x02), wrappedMasterKey, oldIV)

      expect(result.newAuthHash).toBe('newauthhash00000000000000000000000000000000000000000000000')
    })

    it('throws DecryptionError if old password cannot unwrap master key', async () => {
      // Mock derivePasswordKey to return a key different from the one used to wrap
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, 0xff))
      vi.mocked(deriveAuthHash).mockResolvedValue('x'.repeat(64))
      vi.mocked(generateSalt).mockReturnValue(mockBytes(16, 0xaa))

      // Wrap master key with a DIFFERENT key than the mock returns
      const masterKey = generateMasterKey()
      const realKey = await importKey(mockBytes(32, 0x11))
      const oldIV = generateIV()
      const { ciphertext: wrappedMasterKey } = await encrypt(masterKey, realKey, oldIV)

      await expect(
        changePassword('wrongPassword', 'newPw', mockBytes(16, 0x02), wrappedMasterKey, oldIV),
      ).rejects.toThrow(DecryptionError)
    })

    it('calls generateSalt twice for new salts', async () => {
      const masterKey = generateMasterKey()

      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, 0x11))
        .mockImplementationOnce(async () => mockBytes(32, 0x22))
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
      vi.mocked(generateSalt).mockReturnValueOnce(mockBytes(16, 0xaa)).mockReturnValueOnce(mockBytes(16, 0xbb))

      const oldWrappingKey = await importKey(mockBytes(32, 0x11))
      const oldIV = generateIV()
      const { ciphertext: wrappedMasterKey } = await encrypt(masterKey, oldWrappingKey, oldIV)

      await changePassword('oldPw', 'newPw', mockBytes(16, 0x02), wrappedMasterKey, oldIV)

      expect(generateSalt).toHaveBeenCalledTimes(2)
    })

    it('master key content is unchanged after re-wrap', async () => {
      const masterKey = generateMasterKey()

      // Use different fill values so old and new keys differ
      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, 0x11))
        .mockImplementationOnce(async () => mockBytes(32, 0x22))
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
      vi.mocked(generateSalt).mockReturnValueOnce(mockBytes(16, 0xaa)).mockReturnValueOnce(mockBytes(16, 0xbb))

      const oldWrappingKey = await importKey(mockBytes(32, 0x11))
      const oldIV = generateIV()
      const { ciphertext: wrappedMasterKey } = await encrypt(masterKey, oldWrappingKey, oldIV)

      const result = await changePassword('oldPw', 'newPw', mockBytes(16, 0x02), wrappedMasterKey, oldIV)

      // Unwrap with the new password key to verify master key is unchanged
      const newWrappingKey = await importKey(mockBytes(32, 0x22))
      const unwrapped = await decrypt(result.newWrappedMasterKey, newWrappingKey, result.newMasterKeyIV)

      expect(unwrapped).toEqual(masterKey)
    })
  })
})
