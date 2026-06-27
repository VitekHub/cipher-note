import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted values referenced inside vi.mock factories
const {
  mockEnvelope,
  mockUser,
  mockRecoveryData,
  mockMasterKey,
  mockMnemonic,
  mockSaveRecoveryData,
  mockSetCachedEnvelope,
} = vi.hoisted(() => {
  const mockMasterKey = new Uint8Array(32).fill(0xdd) as Uint8Array<ArrayBuffer>
  return {
    mockEnvelope: {
      authHashSalt: 'a1b2c3d4'.repeat(4),
      passwordKeySalt: 'e5f6g7h8'.repeat(4),
      wrappedMasterKey: 'aa'.repeat(48),
      masterKeyIV: 'bb'.repeat(12),
      fieldKeys: [],
    },
    mockUser: { id: 'user-1', username: 'testuser', createdAt: '2024-01-01' },
    mockRecoveryData: {
      recoveryWrappedMasterKey: new Uint8Array(48).fill(0xbb),
      recoveryKeyIV: new Uint8Array(12).fill(0xcc),
      recoveryKeySalt: new Uint8Array(16).fill(0xaa),
    },
    mockMasterKey,
    mockMnemonic: 'word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11',
    mockSaveRecoveryData: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    mockSetCachedEnvelope: vi.fn<(envelope: unknown) => void>(),
  }
})

// Mock auth store
vi.mock('@/features/auth/model/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
    })),
  },
}))

// Mock crypto store
vi.mock('@/shared/crypto/vault/crypto-store', () => ({
  useCryptoStore: {
    getState: vi.fn(() => ({
      cachedEnvelope: mockEnvelope,
      setCachedEnvelope: mockSetCachedEnvelope,
    })),
  },
}))

// Mock API modules
vi.mock('@/shared/api/supabase-keys', () => ({
  fetchFreshEnvelope: vi.fn().mockResolvedValue(mockEnvelope),
}))

vi.mock('@/shared/api/supabase-recovery', () => ({
  saveRecoveryData: mockSaveRecoveryData,
}))

// Mock crypto modules
vi.mock('@/shared/crypto/keys/mnemonic', () => ({
  createRecoveryData: vi.fn().mockResolvedValue({
    mnemonic: mockMnemonic,
    recoveryData: mockRecoveryData,
  }),
}))

vi.mock('@/shared/crypto/keys/master-key', () => ({
  unwrapMasterKeyWithPassword: vi.fn().mockResolvedValue(mockMasterKey),
}))

vi.mock('@/shared/crypto/core/crypto-utils', async () => ({
  ...(await vi.importActual<typeof import('@/shared/crypto/core/crypto-utils')>('@/shared/crypto/core/crypto-utils')),
  hexEncode: vi.fn((data: Uint8Array) =>
    Array.from(data)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join(''),
  ),
  zeroFill: vi.fn(),
}))

import { regenerateMnemonic } from '@/features/auth/model/mnemonic-service'
import { createRecoveryData } from '@/shared/crypto/keys/mnemonic'
import { unwrapMasterKeyWithPassword } from '@/shared/crypto/keys/master-key'
import { saveRecoveryData } from '@/shared/api/supabase-recovery'
import { fetchFreshEnvelope } from '@/shared/api/supabase-keys'
import { hexEncode, zeroFill } from '@/shared/crypto/core/crypto-utils'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'

describe('regenerateMnemonic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when no user is authenticated', async () => {
    vi.mocked(useAuthStore.getState).mockReturnValueOnce({
      user: null,
    } as ReturnType<typeof useAuthStore.getState>)

    await expect(regenerateMnemonic('password')).rejects.toThrow('No authenticated user')
  })

  it('uses cached envelope when available', async () => {
    await regenerateMnemonic('password')

    expect(fetchFreshEnvelope).not.toHaveBeenCalled()
  })

  it('fetches fresh envelope when cache is empty', async () => {
    vi.mocked(useCryptoStore.getState).mockReturnValueOnce({
      loadedFieldKeys: {},
      isVaultLocked: true,
      lastActivity: 0,
      cachedEnvelope: null,
      setCachedEnvelope: mockSetCachedEnvelope,
      markKeysLoaded: vi.fn(),
      lockVault: vi.fn(),
      clearVault: vi.fn(),
      updateActivity: vi.fn(),
    } as ReturnType<typeof useCryptoStore.getState>)

    await regenerateMnemonic('password')

    expect(fetchFreshEnvelope).toHaveBeenCalledWith('user-1')
    expect(mockSetCachedEnvelope).toHaveBeenCalled()
  })

  it('unwraps master key with password and envelope', async () => {
    await regenerateMnemonic('password')

    expect(unwrapMasterKeyWithPassword).toHaveBeenCalledWith('password', mockEnvelope)
  })

  it('creates recovery data from unwrapped master key', async () => {
    await regenerateMnemonic('password')

    expect(createRecoveryData).toHaveBeenCalledWith(mockMasterKey)
  })

  it('saves recovery data with hex-encoded values and correct property names', async () => {
    await regenerateMnemonic('password')

    expect(saveRecoveryData).toHaveBeenCalledWith('user-1', {
      recoveryKeySalt: hexEncode(mockRecoveryData.recoveryKeySalt),
      recoveryWrappedMasterKey: hexEncode(mockRecoveryData.recoveryWrappedMasterKey),
      recoveryKeyIV: hexEncode(mockRecoveryData.recoveryKeyIV),
    })
  })

  it('returns the mnemonic', async () => {
    const result = await regenerateMnemonic('password')

    expect(result).toBe(mockMnemonic)
  })

  it('zero-fills master key on success', async () => {
    await regenerateMnemonic('password')

    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })

  it('zero-fills master key even when saveRecoveryData fails', async () => {
    vi.mocked(saveRecoveryData).mockRejectedValueOnce(new Error('Network error'))

    await expect(regenerateMnemonic('password')).rejects.toThrow('Network error')

    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })

  it('zero-fills master key even when createRecoveryData fails', async () => {
    vi.mocked(createRecoveryData).mockRejectedValueOnce(new Error('Crypto error'))

    await expect(regenerateMnemonic('password')).rejects.toThrow('Crypto error')

    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })
})
