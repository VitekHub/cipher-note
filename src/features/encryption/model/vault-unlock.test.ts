import { describe, it, expect, vi, beforeEach } from 'vitest'

// Helper to create a mock CryptoKey for testing
function createCryptoKeyMock(): CryptoKey {
  return {
    type: 'secret',
    extractable: false,
    algorithm: { name: 'AES-GCM', length: 256 },
    usages: ['encrypt', 'decrypt'],
    [Symbol.toStringTag]: 'CryptoKey',
  } as unknown as CryptoKey
}

const mockSetKeys = vi.fn<(fieldKeyNames: string[]) => void>()
const mockSetEnvelope = vi.fn<(envelope: import('@/shared/types/api.types').CachedVaultEnvelope) => void>()

// Mock key-vault module
const { mockClearVault } = vi.hoisted(() => ({
  mockClearVault: vi.fn<() => void>(),
}))
vi.mock('@/shared/crypto/key-vault', () => ({
  keyVault: {
    lockVault: vi.fn<() => void>(),
    storeKey: vi.fn<() => void>(),
    storeFieldKeys: vi.fn<(kek: CryptoKey, fieldKeys: Map<string, CryptoKey>) => void>(),
    clearVault: mockClearVault,
  },
}))

// Mock Supabase keys
const { mockEnvelopeData, mockFieldKeysData } = vi.hoisted(() => ({
  mockEnvelopeData: {
    authSalt: '01'.repeat(16),
    keySalt: '02'.repeat(16),
    wrappedMasterKey: '05'.repeat(48),
    masterKeyIV: '06'.repeat(12),
  },
  mockFieldKeysData: [
    { fieldName: 'note', version: 1, wrappedKey: 'aa'.repeat(48), keyIV: 'bb'.repeat(12) },
    { fieldName: 'website', version: 1, wrappedKey: 'cc'.repeat(48), keyIV: 'dd'.repeat(12) },
    { fieldName: 'email', version: 1, wrappedKey: 'ee'.repeat(48), keyIV: 'ff'.repeat(12) },
  ],
}))

vi.mock('@/shared/api/supabase-keys', () => ({
  fetchMasterKeyEnvelope: vi.fn().mockResolvedValue(mockEnvelopeData),
  fetchFieldKeys: vi.fn().mockResolvedValue(mockFieldKeysData),
}))

// Mock Argon2id
vi.mock('@/shared/crypto/argon2id', () => ({
  derivePasswordKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x07)),
}))

// Mock crypto memory
vi.mock('@/shared/crypto/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/crypto-utils')),
  hexDecode: vi.fn((data: string) => new Uint8Array(data.length / 2).fill(0x05)),
  zeroFill: vi.fn(),
}))

// Mock AES-GCM
vi.mock('@/shared/crypto/aes-gcm', () => ({
  importKey: vi.fn().mockResolvedValue(createCryptoKeyMock()),
  decrypt: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x03)),
}))

// Mock key-hierarchy
vi.mock('@/shared/crypto/key-hierarchy', () => ({
  unwrapFieldKeys: vi.fn().mockResolvedValue(
    new Map([
      ['note', createCryptoKeyMock()],
      ['website', createCryptoKeyMock()],
      ['email', createCryptoKeyMock()],
    ]),
  ),
}))

// Mock HKDF
vi.mock('@/shared/crypto/hkdf', () => ({
  deriveKEK: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x08)),
}))

// Mock crypto store
const cryptoStoreState = {
  loadedFieldKeys: {} as Record<string, boolean>,
  isVaultLocked: true,
  lastActivity: 0,
  cachedEnvelope: null as import('@/shared/types/api.types').CachedVaultEnvelope | null,
  setKeys: mockSetKeys,
  setCachedEnvelope: mockSetEnvelope,
  lockVault: vi.fn<() => void>(),
  clearVault: mockClearVault,
}

vi.mock('@/shared/crypto/crypto-store', () => ({
  useCryptoStore: {
    getState: vi.fn(() => cryptoStoreState),
    setState: vi.fn(),
  },
}))

import { unlockVault } from '@/features/encryption/model/vault-unlock'
import { fetchMasterKeyEnvelope, fetchFieldKeys } from '@/shared/api/supabase-keys'
import { keyVault } from '@/shared/crypto/key-vault'
import { derivePasswordKey } from '@/shared/crypto/argon2id'
import { deriveKEK } from '@/shared/crypto/hkdf'
import { DecryptionError } from '@/shared/crypto/errors'

describe('unlockVault', () => {
  const mockUserId = 'user-1'

  beforeEach(() => {
    vi.clearAllMocks()
    cryptoStoreState.cachedEnvelope = null
  })

  it('fetches from server and populates vault when no cached envelope', async () => {
    await unlockVault(mockUserId, 'test-password-123')

    expect(fetchMasterKeyEnvelope).toHaveBeenCalledWith('user-1')
    expect(fetchFieldKeys).toHaveBeenCalledWith('user-1')
    expect(derivePasswordKey).toHaveBeenCalled()
    expect(keyVault.storeFieldKeys).toHaveBeenCalled()
    expect(mockSetEnvelope).toHaveBeenCalled()
  })

  it('uses cached envelope without network calls', async () => {
    cryptoStoreState.cachedEnvelope = {
      ...mockEnvelopeData,
      fieldKeys: mockFieldKeysData,
    }

    await unlockVault(mockUserId, 'test-password-123')

    expect(fetchMasterKeyEnvelope).not.toHaveBeenCalled()
    expect(fetchFieldKeys).not.toHaveBeenCalled()
    expect(derivePasswordKey).toHaveBeenCalled()
    expect(keyVault.storeFieldKeys).toHaveBeenCalled()
  })

  it('does not call setCachedEnvelope when envelope is already cached', async () => {
    cryptoStoreState.cachedEnvelope = {
      ...mockEnvelopeData,
      fieldKeys: mockFieldKeysData,
    }

    await unlockVault(mockUserId, 'test-password-123')

    expect(mockSetEnvelope).not.toHaveBeenCalled()
  })

  it('clears cache and retries from server on DecryptionError', async () => {
    cryptoStoreState.cachedEnvelope = {
      ...mockEnvelopeData,
      fieldKeys: mockFieldKeysData,
    }
    // First call (cached envelope) throws DecryptionError
    vi.mocked(deriveKEK)
      .mockRejectedValueOnce(new DecryptionError())
      .mockResolvedValueOnce(new Uint8Array(32).fill(0x08))

    await unlockVault(mockUserId, 'test-password-123')

    expect(mockClearVault).toHaveBeenCalled()
    expect(fetchMasterKeyEnvelope).toHaveBeenCalledWith('user-1')
    expect(fetchFieldKeys).toHaveBeenCalledWith('user-1')
    expect(mockSetEnvelope).toHaveBeenCalled()
    expect(keyVault.storeFieldKeys).toHaveBeenCalled()
  })

  it('re-throws if retry also fails', async () => {
    cryptoStoreState.cachedEnvelope = {
      ...mockEnvelopeData,
      fieldKeys: mockFieldKeysData,
    }
    vi.mocked(deriveKEK).mockRejectedValue(new DecryptionError())

    await expect(unlockVault(mockUserId, 'test-password-123')).rejects.toThrow(DecryptionError)
    expect(mockClearVault).toHaveBeenCalled()
    expect(fetchMasterKeyEnvelope).toHaveBeenCalled()
  })

  it('does not retry on non-DecryptionError', async () => {
    cryptoStoreState.cachedEnvelope = {
      ...mockEnvelopeData,
      fieldKeys: mockFieldKeysData,
    }
    vi.mocked(derivePasswordKey).mockRejectedValueOnce(new Error('Some other error'))

    await expect(unlockVault(mockUserId, 'test-password-123')).rejects.toThrow('Some other error')
    expect(mockClearVault).not.toHaveBeenCalled()
    expect(fetchMasterKeyEnvelope).not.toHaveBeenCalled()
  })
})
