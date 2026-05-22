import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth store
const mockUser = { id: 'user-1', username: 'testuser', createdAt: '2024-01-01' }
vi.mock('@/features/auth/model/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
    })),
  },
}))

// Mock crypto store
const mockSetKeys = vi.fn()
const mockLockVault = vi.fn()
vi.mock('@/features/encryption/model/crypto-store', () => ({
  useCryptoStore: {
    getState: vi.fn(() => ({
      setKeys: mockSetKeys,
      lockVault: mockLockVault,
    })),
  },
}))

// Mock login crypto module
vi.mock('@/features/encryption/model/login', () => ({
  deriveLoginKeys: vi.fn().mockResolvedValue({
    masterKey: new Uint8Array(32).fill(0x03),
    kek: {}, // CryptoKey mock
    fieldKeys: new Map([
      ['note', new Uint8Array(32).fill(0x10)],
      ['website', new Uint8Array(32).fill(0x20)],
      ['email', new Uint8Array(32).fill(0x30)],
    ]),
  }),
}))

// Mock Split KDF
vi.mock('@/shared/crypto/split-kdf', () => ({
  deriveLoginCredentials: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    passwordKey: new Uint8Array(32).fill(0x07),
  }),
}))

// Mock Supabase keys
vi.mock('@/shared/api/supabase-keys', () => ({
  getKeys: vi.fn().mockResolvedValue({
    authSalt: '01'.repeat(16),
    keySalt: '02'.repeat(16),
    wrappedMasterKey: '05'.repeat(48),
    masterKeyIV: '06'.repeat(12),
  }),
  getFieldKeys: vi.fn().mockResolvedValue([
    { fieldName: 'note', version: 1, wrappedKey: 'aa'.repeat(48), keyIV: 'bb'.repeat(12) },
    { fieldName: 'website', version: 1, wrappedKey: 'cc'.repeat(48), keyIV: 'dd'.repeat(12) },
    { fieldName: 'email', version: 1, wrappedKey: 'ee'.repeat(48), keyIV: 'ff'.repeat(12) },
  ]),
}))

// Mock crypto memory
vi.mock('@/shared/crypto/memory', () => ({
  hexEncode: vi.fn((data: Uint8Array) =>
    Array.from(data)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join(''),
  ),
  hexDecode: vi.fn((hex: string) => {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes
  }),
}))

// Mock AES-GCM
vi.mock('@/shared/crypto/aes-gcm', () => ({
  exportKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x04)),
  importKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  generateIV: vi.fn(),
  generateKey: vi.fn(),
}))

import { lockVault, unlockVault } from '@/features/encryption/model/vault-lock'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { deriveLoginKeys } from '@/features/encryption/model/login'
import { deriveLoginCredentials } from '@/shared/crypto/split-kdf'
import { getKeys, getFieldKeys } from '@/shared/api/supabase-keys'

describe('lockVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls cryptoStore.lockVault', () => {
    lockVault()
    expect(mockLockVault).toHaveBeenCalled()
  })
})

describe('unlockVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('derives credentials and populates crypto store', async () => {
    await unlockVault('test-password-123')

    expect(getKeys).toHaveBeenCalledWith('user-1')
    expect(getFieldKeys).toHaveBeenCalledWith('user-1')
    expect(deriveLoginCredentials).toHaveBeenCalledWith(
      'test-password-123',
      expect.any(Uint8Array),
      expect.any(Uint8Array),
    )
    expect(deriveLoginKeys).toHaveBeenCalled()
    expect(mockSetKeys).toHaveBeenCalled()
  })

  it('throws when no user is authenticated', async () => {
    vi.mocked(useAuthStore.getState as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null,
    })

    await expect(unlockVault('test-password-123')).rejects.toThrow('Cannot unlock vault: no authenticated user')
  })

  it('calls setKeys with hex-encoded keys', async () => {
    await unlockVault('test-password-123')

    expect(mockSetKeys).toHaveBeenCalledWith(
      expect.any(String), // masterKeyHex
      expect.any(String), // kekHex
      expect.any(Object), // fieldKeysHex
    )
  })
})
