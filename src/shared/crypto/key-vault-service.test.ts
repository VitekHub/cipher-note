import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockEnvelopeData, mockFieldKeysData, mockClearVault } = vi.hoisted(() => ({
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
  mockClearVault: vi.fn<() => void>(),
}))

// Mock key-vault module
vi.mock('@/shared/crypto/key-vault', () => ({
  keyVault: {
    lockVault: vi.fn<() => void>(),
    storeKey: vi.fn<() => void>(),
    storeFieldKeys: vi.fn<(kek: CryptoKey, fieldKeys: Map<string, CryptoKey>) => void>(),
    clearVault: mockClearVault,
  },
}))

// Mock Supabase keys
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
  importKey: vi.fn().mockResolvedValue({} as CryptoKey),
  decrypt: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x03)),
}))

// Mock key-hierarchy
vi.mock('@/shared/crypto/key-hierarchy', () => ({
  unwrapFieldKeys: vi.fn().mockResolvedValue(
    new Map<string, CryptoKey>([
      ['note', {} as CryptoKey],
      ['website', {} as CryptoKey],
      ['email', {} as CryptoKey],
    ]),
  ),
}))

// Mock HKDF
vi.mock('@/shared/crypto/hkdf', () => ({
  deriveKEK: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x08)),
}))

// Mock crypto store
const mockSetEnvelope = vi.fn<(envelope: import('@/shared/types/api.types').CachedVaultEnvelope) => void>()
const cryptoStoreState = {
  loadedFieldKeys: {} as Record<string, boolean>,
  isVaultLocked: true,
  lastActivity: 0,
  cachedEnvelope: null as import('@/shared/types/api.types').CachedVaultEnvelope | null,
  setCachedEnvelope: mockSetEnvelope,
  lockVault: vi.fn<() => void>(),
  clearVault: vi.fn(),
}

vi.mock('@/shared/crypto/crypto-store', () => ({
  useCryptoStore: {
    getState: vi.fn(() => cryptoStoreState),
    setState: vi.fn(),
  },
}))

import { populateKeyVault } from '@/shared/crypto/key-vault-service'
import { fetchMasterKeyEnvelope, fetchFieldKeys } from '@/shared/api/supabase-keys'
import { keyVault } from '@/shared/crypto/key-vault'
import { derivePasswordKey } from '@/shared/crypto/argon2id'
import { importKey, decrypt } from '@/shared/crypto/aes-gcm'
import { deriveKEK } from '@/shared/crypto/hkdf'
import { unwrapFieldKeys } from '@/shared/crypto/key-hierarchy'

describe('populateKeyVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cryptoStoreState.isVaultLocked = true
  })

  it('fetches envelope and field keys after authentication', async () => {
    await populateKeyVault('1', 'testpass123')

    expect(fetchMasterKeyEnvelope).toHaveBeenCalledWith('1')
    expect(fetchFieldKeys).toHaveBeenCalledWith('1')
  })

  it('derives KEK from password and envelope, then stores field keys', async () => {
    await populateKeyVault('1', 'testpass123')

    expect(derivePasswordKey).toHaveBeenCalledWith('testpass123', expect.any(Uint8Array))
    expect(importKey).toHaveBeenCalled()
    expect(decrypt).toHaveBeenCalled()
    expect(deriveKEK).toHaveBeenCalled()
    expect(unwrapFieldKeys).toHaveBeenCalledWith(mockFieldKeysData, expect.any(Object))
    expect(keyVault.storeFieldKeys).toHaveBeenCalled()
  })

  it('caches envelope data after login', async () => {
    await populateKeyVault('1', 'testpass123')
    expect(mockSetEnvelope).toHaveBeenCalledWith({
      ...mockEnvelopeData,
      fieldKeys: mockFieldKeysData,
    })
  })

  it('uses cached envelope when provided instead of fetching from server', async () => {
    const cachedEnvelope = {
      authSalt: 'aa'.repeat(16),
      keySalt: 'bb'.repeat(16),
      wrappedMasterKey: 'cc'.repeat(48),
      masterKeyIV: 'dd'.repeat(12),
      fieldKeys: mockFieldKeysData,
    }

    await populateKeyVault('1', 'testpass123', cachedEnvelope)

    expect(fetchMasterKeyEnvelope).not.toHaveBeenCalled()
    expect(fetchFieldKeys).not.toHaveBeenCalled()
    expect(mockSetEnvelope).not.toHaveBeenCalled()
    expect(derivePasswordKey).toHaveBeenCalledWith('testpass123', expect.any(Uint8Array))
    expect(keyVault.storeFieldKeys).toHaveBeenCalled()
  })

  it('does not store field keys when key derivation fails', async () => {
    vi.mocked(decrypt).mockRejectedValueOnce(new Error('Decryption failed'))

    await expect(populateKeyVault('1', 'testpass123')).rejects.toThrow('Decryption failed')

    expect(keyVault.storeFieldKeys).not.toHaveBeenCalled()
  })

  it('does not store field keys when fetching envelope fails', async () => {
    vi.mocked(fetchMasterKeyEnvelope).mockRejectedValueOnce(new Error('Network error'))

    await expect(populateKeyVault('1', 'testpass123')).rejects.toThrow('Network error')

    expect(keyVault.storeFieldKeys).not.toHaveBeenCalled()
  })

  it('does not store field keys when fetching field keys fails', async () => {
    vi.mocked(fetchFieldKeys).mockRejectedValueOnce(new Error('Network error'))

    await expect(populateKeyVault('1', 'testpass123')).rejects.toThrow('Network error')

    expect(keyVault.storeFieldKeys).not.toHaveBeenCalled()
  })

  it('does not store field keys when unwrapping fails', async () => {
    vi.mocked(unwrapFieldKeys).mockRejectedValueOnce(new Error('Unwrap failed'))

    await expect(populateKeyVault('1', 'testpass123')).rejects.toThrow('Unwrap failed')

    expect(keyVault.storeFieldKeys).not.toHaveBeenCalled()
  })
})
