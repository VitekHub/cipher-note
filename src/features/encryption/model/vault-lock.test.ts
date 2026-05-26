import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'

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
const mockClearVault = vi.fn()
const mockSetEnvelope = vi.fn()

const createStoreState = (overrides?: Partial<{ cachedEnvelope: CachedVaultEnvelope | null }>) => ({
  setKeys: mockSetKeys,
  lockVault: mockLockVault,
  clearVault: mockClearVault,
  setCachedEnvelope: mockSetEnvelope,
  cachedEnvelope: null as CachedVaultEnvelope | null,
  ...overrides,
})

vi.mock('@/features/encryption/model/crypto-store', () => ({
  useCryptoStore: {
    getState: vi.fn(() => createStoreState()),
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
  getMasterKeyEnvelope: vi.fn().mockResolvedValue({
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

// Mock AES-GCM
vi.mock('@/shared/crypto/aes-gcm', () => ({
  exportKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x04)),
  importKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}))

import { lockVault, unlockVault, clearVault } from '@/features/encryption/model/vault-lock'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { deriveLoginKeys } from '@/features/encryption/model/login'
import { deriveLoginCredentials } from '@/shared/crypto/split-kdf'
import { getMasterKeyEnvelope, getFieldKeys } from '@/shared/api/supabase-keys'
import { DecryptionError } from '@/shared/crypto/errors'

const cachedEnvelope: CachedVaultEnvelope = {
  authSalt: '01'.repeat(16),
  keySalt: '02'.repeat(16),
  wrappedMasterKey: '05'.repeat(48),
  masterKeyIV: '06'.repeat(12),
  fieldKeys: [
    { fieldName: 'note', version: 1, wrappedKey: 'aa'.repeat(48), keyIV: 'bb'.repeat(12) },
    { fieldName: 'website', version: 1, wrappedKey: 'cc'.repeat(48), keyIV: 'dd'.repeat(12) },
    { fieldName: 'email', version: 1, wrappedKey: 'ee'.repeat(48), keyIV: 'ff'.repeat(12) },
  ],
}

describe('lockVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls cryptoStore.lockVault', () => {
    lockVault()
    expect(mockLockVault).toHaveBeenCalled()
  })
})

describe('clearVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls cryptoStore.clearVault', () => {
    clearVault()
    expect(mockClearVault).toHaveBeenCalled()
  })
})

describe('unlockVault (network path)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches envelope from server and populates crypto store', async () => {
    await unlockVault('test-password-123')

    expect(getMasterKeyEnvelope).toHaveBeenCalledWith('user-1')
    expect(getFieldKeys).toHaveBeenCalledWith('user-1')
    expect(deriveLoginCredentials).toHaveBeenCalledWith(
      'test-password-123',
      expect.any(Uint8Array),
      expect.any(Uint8Array),
    )
    expect(deriveLoginKeys).toHaveBeenCalled()
    expect(mockSetKeys).toHaveBeenCalled()
  })

  it('caches envelope after fetching from server', async () => {
    await unlockVault('test-password-123')

    expect(mockSetEnvelope).toHaveBeenCalledWith({
      authSalt: '01'.repeat(16),
      keySalt: '02'.repeat(16),
      wrappedMasterKey: '05'.repeat(48),
      masterKeyIV: '06'.repeat(12),
      fieldKeys: [
        { fieldName: 'note', version: 1, wrappedKey: 'aa'.repeat(48), keyIV: 'bb'.repeat(12) },
        { fieldName: 'website', version: 1, wrappedKey: 'cc'.repeat(48), keyIV: 'dd'.repeat(12) },
        { fieldName: 'email', version: 1, wrappedKey: 'ee'.repeat(48), keyIV: 'ff'.repeat(12) },
      ],
    })
  })

  it('throws when no user is authenticated', async () => {
    vi.mocked(useAuthStore.getState as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: null,
    })

    await expect(unlockVault('test-password-123')).rejects.toThrow('Cannot unlock vault: no authenticated user')
  })

  it('does not populate crypto store when getMasterKeyEnvelope fails', async () => {
    vi.mocked(getMasterKeyEnvelope).mockRejectedValueOnce(new Error('Network error'))

    await expect(unlockVault('test-password-123')).rejects.toThrow('Network error')

    expect(mockSetKeys).not.toHaveBeenCalled()
  })

  it('does not populate crypto store when key unwrapping fails', async () => {
    vi.mocked(deriveLoginKeys).mockRejectedValueOnce(new Error('Decryption failed'))

    await expect(unlockVault('test-password-123')).rejects.toThrow('Decryption failed')

    expect(mockSetKeys).not.toHaveBeenCalled()
  })
})

describe('unlockVault (cached envelope)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCryptoStore.getState).mockReturnValue(createStoreState({ cachedEnvelope }))
  })

  afterEach(() => {
    vi.mocked(useCryptoStore.getState).mockReturnValue(createStoreState())
  })

  it('skips network calls and uses cached envelope', async () => {
    await unlockVault('test-password-123')

    expect(getMasterKeyEnvelope).not.toHaveBeenCalled()
    expect(getFieldKeys).not.toHaveBeenCalled()
    expect(deriveLoginCredentials).toHaveBeenCalledWith(
      'test-password-123',
      expect.any(Uint8Array),
      expect.any(Uint8Array),
    )
    expect(mockSetKeys).toHaveBeenCalled()
  })

  it('does not call setCachedEnvelope again when envelope is already cached', async () => {
    await unlockVault('test-password-123')

    expect(mockSetEnvelope).not.toHaveBeenCalled()
  })

  it('clears cache and retries from server on DecryptionError', async () => {
    vi.mocked(deriveLoginKeys)
      .mockRejectedValueOnce(new DecryptionError())
      .mockResolvedValueOnce({
        masterKey: new Uint8Array(32).fill(0x03),
        kek: {},
        fieldKeys: new Map([
          ['note', new Uint8Array(32).fill(0x10)],
          ['website', new Uint8Array(32).fill(0x20)],
          ['email', new Uint8Array(32).fill(0x30)],
        ]),
      })

    await unlockVault('test-password-123')

    expect(mockClearVault).toHaveBeenCalled()
    expect(getMasterKeyEnvelope).toHaveBeenCalledWith('user-1')
    expect(getFieldKeys).toHaveBeenCalledWith('user-1')
    expect(mockSetEnvelope).toHaveBeenCalled()
    expect(mockSetKeys).toHaveBeenCalled()
  })

  it('re-throws if retry also fails', async () => {
    vi.mocked(deriveLoginKeys).mockRejectedValueOnce(new DecryptionError()).mockRejectedValueOnce(new DecryptionError())

    await expect(unlockVault('test-password-123')).rejects.toThrow(DecryptionError)
    expect(mockClearVault).toHaveBeenCalled()
    expect(getMasterKeyEnvelope).toHaveBeenCalled()
  })

  it('does not retry on non-DecryptionError', async () => {
    vi.mocked(deriveLoginKeys).mockRejectedValueOnce(new Error('Some other error'))

    await expect(unlockVault('test-password-123')).rejects.toThrow('Some other error')
    expect(mockClearVault).not.toHaveBeenCalled()
    expect(getMasterKeyEnvelope).not.toHaveBeenCalled()
  })
})
