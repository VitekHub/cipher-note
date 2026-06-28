import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deriveAuthCredentials, derivePasswordKey } from '@/shared/crypto/keys/split-kdf'
import { HKDF_INFO } from '@/shared/crypto/core/hkdf'
import type { AuthCredentials } from '@/shared/types/crypto.types'

// Mock argon2id module to avoid WASM/worker dependency in tests
vi.mock('@/shared/crypto/core/argon2id', () => ({
  deriveKey: vi.fn(),
}))

// Mock hkdfExpand to control HKDF branch outputs
vi.mock('@/shared/crypto/core/hkdf', async () => ({
  ...(await vi.importActual('@/shared/crypto/core/hkdf')),
  hkdfExpand: vi.fn(),
}))

// Mock crypto-utils — zeroFill must be tracked
vi.mock('@/shared/crypto/core/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/core/crypto-utils')),
  zeroFill: vi.fn(),
  hexDecode: (hex: string) => {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes as Uint8Array<ArrayBuffer>
  },
  hexEncode: (bytes: Uint8Array<ArrayBuffer>) =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
}))

import { deriveKey } from '@/shared/crypto/core/argon2id'
import { hkdfExpand } from '@/shared/crypto/core/hkdf'
import { zeroFill, hexDecode } from '@/shared/crypto/core/crypto-utils'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

describe('split-kdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deriveAuthCredentials', () => {
    it('derives authHash and passwordKey from a single Argon2id call + HKDF branching', async () => {
      const kdfSalt = mockBytes(16, 0x01)
      const masterSecret = mockBytes(32, 0xab)
      const authHashBytes = mockBytes(32, 0xcd)
      const passwordKeyBytes = mockBytes(32, 0xef)

      vi.mocked(deriveKey).mockResolvedValue(masterSecret)
      vi.mocked(hkdfExpand)
        .mockResolvedValueOnce(authHashBytes) // HKDF_INFO.AUTH
        .mockResolvedValueOnce(passwordKeyBytes) // HKDF_INFO.PASSWORD_KEY

      const result = await deriveAuthCredentials('password123', kdfSalt)

      // Single Argon2id call with the provided salt
      expect(deriveKey).toHaveBeenCalledWith('password123', kdfSalt)

      // HKDF branches called with the master secret
      expect(hkdfExpand).toHaveBeenCalledWith(masterSecret, HKDF_INFO.AUTH)
      expect(hkdfExpand).toHaveBeenCalledWith(masterSecret, HKDF_INFO.PASSWORD_KEY)

      // authHash is hex-encoded, passwordKey is raw bytes, kdfSalt is passed through
      expect(result).toEqual({
        authHash: Array.from(authHashBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
        passwordKey: passwordKeyBytes,
        kdfSalt,
      })
    })

    it('returns AuthCredentials with correct types', async () => {
      const kdfSalt = mockBytes(16, 0x01)
      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, 0xff))
      vi.mocked(hkdfExpand)
        .mockResolvedValueOnce(mockBytes(32, 0xaa)) // AUTH branch
        .mockResolvedValueOnce(mockBytes(32, 0xbb)) // PASSWORD_KEY branch

      const result: AuthCredentials = await deriveAuthCredentials('test', kdfSalt)

      expect(typeof result.authHash).toBe('string')
      expect(result.authHash).toHaveLength(64) // 32 bytes = 64 hex chars
      expect(result.passwordKey).toBeInstanceOf(Uint8Array)
      expect(result.passwordKey.byteLength).toBe(32)
      expect(result.kdfSalt).toBe(kdfSalt)
    })

    it('zero-fills the master secret after branching', async () => {
      const kdfSalt = mockBytes(16, 0x01)
      const masterSecret = mockBytes(32, 0xab)

      vi.mocked(deriveKey).mockResolvedValue(masterSecret)
      vi.mocked(hkdfExpand).mockResolvedValueOnce(mockBytes(32, 0xaa)).mockResolvedValueOnce(mockBytes(32, 0xbb))

      await deriveAuthCredentials('test', kdfSalt)

      expect(zeroFill).toHaveBeenCalledWith(masterSecret)
    })
  })

  describe('derivePasswordKey', () => {
    it('derives password key from a single Argon2id call + one HKDF branch', async () => {
      const kdfSaltHex = '01'.repeat(16) // 32 hex chars = 16 bytes
      const masterSecret = mockBytes(32, 0xab)
      const passwordKeyBytes = mockBytes(32, 0xef)

      vi.mocked(deriveKey).mockResolvedValue(masterSecret)
      vi.mocked(hkdfExpand).mockResolvedValue(passwordKeyBytes)

      const result = await derivePasswordKey('test-password', kdfSaltHex)

      // Argon2id called with password and hex-decoded salt
      expect(deriveKey).toHaveBeenCalledWith('test-password', hexDecode(kdfSaltHex))

      // HKDF called with master secret and PASSWORD_KEY info
      expect(hkdfExpand).toHaveBeenCalledWith(masterSecret, HKDF_INFO.PASSWORD_KEY)

      expect(result).toBe(passwordKeyBytes)
    })

    it('zero-fills the master secret after derivation', async () => {
      const kdfSaltHex = '01'.repeat(16)
      const masterSecret = mockBytes(32, 0xab)

      vi.mocked(deriveKey).mockResolvedValue(masterSecret)
      vi.mocked(hkdfExpand).mockResolvedValue(mockBytes(32, 0xef))

      await derivePasswordKey('test-password', kdfSaltHex)

      expect(zeroFill).toHaveBeenCalledWith(masterSecret)
    })
  })
})
