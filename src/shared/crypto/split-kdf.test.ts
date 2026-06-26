import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deriveAuthCredentials, deriveAuthHash, derivePasswordKey } from '@/shared/crypto/split-kdf'
import type { AuthCredentials } from '@/shared/types/crypto.types'

// Mock argon2id module to avoid WASM/worker dependency in tests
vi.mock('@/shared/crypto/argon2id', () => ({
  deriveKey: vi.fn(),
}))

import { deriveKey } from '@/shared/crypto/argon2id'

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

  describe('deriveAuthHash', () => {
    it('returns 64-character hex string from derived key', async () => {
      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, 0xab))

      const result = await deriveAuthHash('test-password', mockBytes(16, 0x01))

      expect(deriveKey).toHaveBeenCalledWith('test-password', expect.any(Uint8Array))
      expect(typeof result).toBe('string')
      expect(result).toHaveLength(64)
      expect(result).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('derivePasswordKey', () => {
    it('returns Uint8Array from derived key', async () => {
      const keyBytes = mockBytes(32, 0xcd)
      vi.mocked(deriveKey).mockResolvedValue(keyBytes)

      const result = await derivePasswordKey('test-password', mockBytes(16, 0x02))

      expect(deriveKey).toHaveBeenCalledWith('test-password', expect.any(Uint8Array))
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.byteLength).toBe(32)
    })
  })

  describe('deriveAuthCredentials', () => {
    it('generates two salts and derives authHash and passwordKey in parallel', async () => {
      const authHashSalt = mockBytes(16, 0x01)
      const passwordKeySalt = mockBytes(16, 0x02)
      vi.mocked(generateSalt).mockReturnValueOnce(authHashSalt).mockReturnValueOnce(passwordKeySalt)
      // deriveAuthHash calls deriveKey first, then derivePasswordKey calls it second
      vi.mocked(deriveKey)
        .mockResolvedValueOnce(mockBytes(32, 0xab)) // for deriveAuthHash → hexEncode
        .mockResolvedValueOnce(mockBytes(32, 0xcd)) // for derivePasswordKey

      const result = await deriveAuthCredentials('password123')

      expect(generateSalt).toHaveBeenCalledTimes(2)
      expect(deriveKey).toHaveBeenCalledWith('password123', authHashSalt)
      expect(deriveKey).toHaveBeenCalledWith('password123', passwordKeySalt)
      expect(result).toEqual({
        authHash: expect.any(String),
        passwordKey: mockBytes(32, 0xcd),
        authHashSalt,
        passwordKeySalt,
      })
      expect(result.authHash).toHaveLength(64)
    })

    it('returns AuthCredentials with correct types', async () => {
      vi.mocked(generateSalt).mockReturnValue(mockBytes(16, 0x01))
      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, 0xff))

      const result: AuthCredentials = await deriveAuthCredentials('test')

      expect(typeof result.authHash).toBe('string')
      expect(result.authHash).toHaveLength(64)
      expect(result.passwordKey).toBeInstanceOf(Uint8Array)
      expect(result.passwordKey.byteLength).toBe(32)
      expect(result.authHashSalt).toBeInstanceOf(Uint8Array)
      expect(result.authHashSalt.byteLength).toBe(16)
      expect(result.passwordKeySalt).toBeInstanceOf(Uint8Array)
      expect(result.passwordKeySalt.byteLength).toBe(16)
    })
  })
})
