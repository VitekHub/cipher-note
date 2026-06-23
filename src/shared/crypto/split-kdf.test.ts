import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DecryptionError } from '@/shared/crypto/errors'
import { deriveAuthCredentials, changePassword } from '@/shared/crypto/split-kdf'
import { importKey, encrypt, decrypt } from '@/shared/crypto/aes-gcm'
import { generateMasterKey } from '@/shared/crypto/key-hierarchy'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { AuthCredentials, PasswordChangeResult } from '@/shared/types/crypto.types'
import type { ServerMasterKeyEnvelope } from '@/shared/types/api.types'

// Mock Argon2id module to avoid WASM/worker dependency in tests
vi.mock('@/shared/crypto/argon2id', () => ({
  deriveAuthHash: vi.fn(),
  derivePasswordKey: vi.fn(),
}))

import { deriveAuthHash, derivePasswordKey } from '@/shared/crypto/argon2id'

// Mock crypto-utils module — allow generateSalt to be controlled per-test
vi.mock('@/shared/crypto/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/crypto-utils')),
  generateSalt: vi.fn(),
}))
import { generateIV, generateSalt, hexEncode } from '@/shared/crypto/crypto-utils'

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
    // Use real AES-GCM for wrapping/unwrapping since changePassword
    // composes real crypto operations on the master key.

    async function wrapMasterKey(
      masterKey: Uint8Array<ArrayBuffer>,
      keyFill: number,
    ): Promise<{ wrappedMasterKey: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer> }> {
      const wrappingKey = await importKey(mockBytes(32, keyFill))
      const iv = generateIV()
      const wrappedMasterKey = await encrypt(masterKey, wrappingKey, { iv, aad: MASTER_KEY_PASSWORD_AAD })
      return { wrappedMasterKey, iv }
    }

    /** Build a ServerMasterKeyEnvelope from raw bytes (hex-encodes the values). */
    function makeEnvelope(
      keySalt: Uint8Array<ArrayBuffer>,
      wrapped: Uint8Array<ArrayBuffer>,
      iv: Uint8Array<ArrayBuffer>,
    ): ServerMasterKeyEnvelope {
      return {
        authSalt: hexEncode(mockBytes(16, 0xaa)),
        keySalt: hexEncode(keySalt),
        wrappedMasterKey: hexEncode(wrapped),
        masterKeyIV: hexEncode(iv),
      }
    }

    const OLD_KEY_FILL = 0x11
    const NEW_KEY_FILL = 0x22

    it('unwraps master key with old password and re-wraps with new password', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, OLD_KEY_FILL))
        .mockImplementationOnce(async () => mockBytes(32, NEW_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('newhash'.padEnd(64, '0'))

      const { wrappedMasterKey, iv: oldIV } = await wrapMasterKey(masterKey, OLD_KEY_FILL)
      const envelope = makeEnvelope(mockBytes(16, 0x02), wrappedMasterKey, oldIV)

      const result: PasswordChangeResult = await changePassword('oldPassword', 'newPassword', envelope)

      const newWrappingKey = await importKey(mockBytes(32, NEW_KEY_FILL))
      const unwrappedMasterKey = await decrypt(result.newWrappedMasterKey, newWrappingKey, {
        iv: result.newMasterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })

      expect(unwrappedMasterKey).toEqual(masterKey)
    })

    it('generates new salts that differ from old salts', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, OLD_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))

      const newAuthSalt = mockBytes(16, 0xbb)
      const newKeySalt = mockBytes(16, 0xcc)
      vi.mocked(generateSalt).mockReturnValueOnce(newAuthSalt).mockReturnValueOnce(newKeySalt)

      const { wrappedMasterKey, iv: oldIV } = await wrapMasterKey(masterKey, OLD_KEY_FILL)
      const envelope = makeEnvelope(mockBytes(16, 0x02), wrappedMasterKey, oldIV)

      const result = await changePassword('oldPw', 'newPw', envelope)

      expect(result.newAuthSalt).toEqual(newAuthSalt)
      expect(result.newKeySalt).toEqual(newKeySalt)
    })

    it('returns newAuthHash from deriveAuthHash', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, OLD_KEY_FILL))
        .mockImplementationOnce(async () => mockBytes(32, NEW_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('newauthhash00000000000000000000000000000000000000000000000')

      vi.mocked(generateSalt).mockReturnValueOnce(mockBytes(16, 0xaa)).mockReturnValueOnce(mockBytes(16, 0xbb))

      const { wrappedMasterKey, iv: oldIV } = await wrapMasterKey(masterKey, OLD_KEY_FILL)
      const envelope = makeEnvelope(mockBytes(16, 0x02), wrappedMasterKey, oldIV)

      const result = await changePassword('oldPw', 'newPw', envelope)

      expect(result.newAuthHash).toBe('newauthhash00000000000000000000000000000000000000000000000')
    })

    it('throws DecryptionError if old password cannot unwrap master key', async () => {
      vi.mocked(derivePasswordKey).mockResolvedValue(mockBytes(32, 0xff))
      vi.mocked(deriveAuthHash).mockResolvedValue('x'.repeat(64))
      vi.mocked(generateSalt).mockReturnValue(mockBytes(16, 0xaa))

      // Wrap master key with a DIFFERENT key than the mock returns
      const masterKey = generateMasterKey()
      const { wrappedMasterKey, iv: oldIV } = await wrapMasterKey(masterKey, OLD_KEY_FILL)
      const envelope = makeEnvelope(mockBytes(16, 0x02), wrappedMasterKey, oldIV)

      await expect(changePassword('wrongPassword', 'newPw', envelope)).rejects.toThrow(DecryptionError)
    })

    it('calls generateSalt twice for new salts', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, OLD_KEY_FILL))
        .mockImplementationOnce(async () => mockBytes(32, NEW_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
      vi.mocked(generateSalt).mockReturnValueOnce(mockBytes(16, 0xaa)).mockReturnValueOnce(mockBytes(16, 0xbb))

      const { wrappedMasterKey, iv: oldIV } = await wrapMasterKey(masterKey, OLD_KEY_FILL)
      const envelope = makeEnvelope(mockBytes(16, 0x02), wrappedMasterKey, oldIV)

      await changePassword('oldPw', 'newPw', envelope)

      expect(generateSalt).toHaveBeenCalledTimes(2)
    })

    it('master key content is unchanged after re-wrap', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(derivePasswordKey)
        .mockImplementationOnce(async () => mockBytes(32, OLD_KEY_FILL))
        .mockImplementationOnce(async () => mockBytes(32, NEW_KEY_FILL))
      vi.mocked(deriveAuthHash).mockResolvedValue('a'.repeat(64))
      vi.mocked(generateSalt).mockReturnValueOnce(mockBytes(16, 0xaa)).mockReturnValueOnce(mockBytes(16, 0xbb))

      const { wrappedMasterKey, iv: oldIV } = await wrapMasterKey(masterKey, OLD_KEY_FILL)
      const envelope = makeEnvelope(mockBytes(16, 0x02), wrappedMasterKey, oldIV)

      const result = await changePassword('oldPw', 'newPw', envelope)

      const newWrappingKey = await importKey(mockBytes(32, NEW_KEY_FILL))
      const unwrapped = await decrypt(result.newWrappedMasterKey, newWrappingKey, {
        iv: result.newMasterKeyIV,
        aad: MASTER_KEY_PASSWORD_AAD,
      })

      expect(unwrapped).toEqual(masterKey)
    })
  })
})
