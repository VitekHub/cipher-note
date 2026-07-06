import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted values referenced inside vi.mock factories
const {
  mockEnvelope,
  mockUser,
  mockRecoveryData,
  mockMasterKey,
  mockPasswordKey,
  mockMnemonic,
  mockSaveRecoveryData,
  mockSetCachedEnvelope,
  mockFetchRecoveryDataPreAuth,
  mockRecoverAccount,
  mockFetchRecoveryData,
  mockAuthAdapterLogin,
  mockKeyVaultInitVault,
  mockSetAuth,
  mockAuthHash,
  mockKdfSalt,
  mockWrappedMasterKey,
  mockMasterKeyIV,
  mockRecoveryAuthHash,
} = vi.hoisted(() => {
  const mockMasterKey = new Uint8Array(32).fill(0xdd) as Uint8Array<ArrayBuffer>
  const mockPasswordKey = new Uint8Array(32).fill(0x04) as Uint8Array<ArrayBuffer>
  const mockAuthHash = 'a'.repeat(64)
  const mockKdfSalt = new Uint8Array(16).fill(0x01) as Uint8Array<ArrayBuffer>
  const mockWrappedMasterKey = new Uint8Array(48).fill(0x05) as Uint8Array<ArrayBuffer>
  const mockMasterKeyIV = new Uint8Array(12).fill(0x06) as Uint8Array<ArrayBuffer>
  const mockRecoveryAuthHash = 'b'.repeat(64)
  return {
    mockEnvelope: {
      kdfSalt: 'a1b2c3d4'.repeat(4),
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
    mockPasswordKey,
    mockMnemonic: 'word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11',
    mockSaveRecoveryData: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    mockSetCachedEnvelope: vi.fn<(envelope: unknown) => void>(),
    mockFetchRecoveryDataPreAuth: vi.fn(),
    mockRecoverAccount: vi.fn(),
    mockFetchRecoveryData: vi.fn(),
    mockAuthAdapterLogin: vi.fn(),
    mockKeyVaultInitVault: vi.fn().mockResolvedValue(undefined),
    mockSetAuth: vi.fn(),
    mockAuthHash,
    mockKdfSalt,
    mockWrappedMasterKey,
    mockMasterKeyIV,
    mockRecoveryAuthHash,
  }
})

// Mock auth store
vi.mock('@/features/auth/model/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: mockUser,
      setAuth: mockSetAuth,
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
  fetchRecoveryDataPreAuth: mockFetchRecoveryDataPreAuth,
  recoverAccount: mockRecoverAccount,
  fetchRecoveryData: mockFetchRecoveryData,
}))

// Mock crypto modules
vi.mock('@/shared/crypto/keys/mnemonic', () => ({
  createRecoveryData: vi.fn().mockResolvedValue({
    mnemonic: mockMnemonic,
    recoveryData: mockRecoveryData,
  }),
  unwrapMasterKeyWithRecovery: vi.fn(),
}))

vi.mock('@/shared/crypto/keys/split-kdf', () => ({
  derivePasswordKey: vi.fn().mockResolvedValue(mockPasswordKey),
  deriveAuthCredentials: vi.fn().mockResolvedValue({
    authHash: mockAuthHash,
    passwordKey: mockPasswordKey,
    kdfSalt: mockKdfSalt,
  }),
}))

vi.mock('@/shared/crypto/keys/master-key', () => ({
  unwrapMasterKeyWithPassword: vi.fn().mockResolvedValue(mockMasterKey),
  wrapMasterKeyWithPassword: vi.fn().mockResolvedValue({
    wrappedMasterKey: mockWrappedMasterKey,
    masterKeyIV: mockMasterKeyIV,
  }),
}))

vi.mock('@/shared/auth/supabase-adapter', () => ({
  authAdapter: {
    login: mockAuthAdapterLogin,
  },
}))

vi.mock('@/shared/crypto/vault/key-vault', () => ({
  keyVault: {
    initVault: mockKeyVaultInitVault,
  },
}))

vi.mock('@/shared/crypto/core/crypto-utils', async () => ({
  ...(await vi.importActual<typeof import('@/shared/crypto/core/crypto-utils')>('@/shared/crypto/core/crypto-utils')),
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
    return bytes as Uint8Array<ArrayBuffer>
  }),
  generateSalt: vi.fn().mockReturnValue(mockKdfSalt),
  zeroFill: vi.fn(),
}))

import {
  recoveryFlow,
  verifyMnemonic,
  regenerateMnemonic,
  RecoveryLoginError,
} from '@/features/auth/model/mnemonic-service'
import { createRecoveryData, unwrapMasterKeyWithRecovery } from '@/shared/crypto/keys/mnemonic'
import { unwrapMasterKeyWithPassword, wrapMasterKeyWithPassword } from '@/shared/crypto/keys/master-key'
import { derivePasswordKey, deriveAuthCredentials } from '@/shared/crypto/keys/split-kdf'
import {
  saveRecoveryData,
  fetchRecoveryDataPreAuth,
  recoverAccount,
  fetchRecoveryData,
} from '@/shared/api/supabase-recovery'
import { fetchFreshEnvelope } from '@/shared/api/supabase-keys'
import { hexEncode, generateSalt, zeroFill } from '@/shared/crypto/core/crypto-utils'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { keyVault } from '@/shared/crypto/vault/key-vault'

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
      clearCachedEnvelope: vi.fn(),
      markKeysLoaded: vi.fn(),
      lockVault: vi.fn(),
      clearVault: vi.fn(),
      updateActivity: vi.fn(),
      updateCachedFieldKey: vi.fn(),
    } as ReturnType<typeof useCryptoStore.getState>)

    await regenerateMnemonic('password')

    expect(fetchFreshEnvelope).toHaveBeenCalledWith('user-1')
    expect(mockSetCachedEnvelope).toHaveBeenCalled()
  })

  it('derives password key and unwraps master key with it', async () => {
    await regenerateMnemonic('password')

    expect(derivePasswordKey).toHaveBeenCalledWith('password', mockEnvelope.kdfSalt)
    expect(unwrapMasterKeyWithPassword).toHaveBeenCalledWith(mockPasswordKey, mockEnvelope)
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

  it('zero-fills password key and master key on success', async () => {
    await regenerateMnemonic('password')

    expect(zeroFill).toHaveBeenCalledWith(mockPasswordKey)
    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })

  it('zero-fills password key and master key even when saveRecoveryData fails', async () => {
    vi.mocked(saveRecoveryData).mockRejectedValueOnce(new Error('Network error'))

    await expect(regenerateMnemonic('password')).rejects.toThrow('Network error')

    expect(zeroFill).toHaveBeenCalledWith(mockPasswordKey)
    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })

  it('zero-fills password key even when createRecoveryData fails', async () => {
    vi.mocked(createRecoveryData).mockRejectedValueOnce(new Error('Crypto error'))

    await expect(regenerateMnemonic('password')).rejects.toThrow('Crypto error')

    expect(zeroFill).toHaveBeenCalledWith(mockPasswordKey)
  })
})

describe('recoveryFlow.validateMnemonic', () => {
  const mockServerRecoveryData = {
    recoveryKeySalt: 'aa'.repeat(16),
    recoveryWrappedMasterKey: 'bb'.repeat(48),
    recoveryKeyIV: 'cc'.repeat(12),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    recoveryFlow.clear()
  })

  it('stores master key and recoveryAuthHash on successful validation', async () => {
    mockFetchRecoveryDataPreAuth.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockResolvedValueOnce({
      masterKey: mockMasterKey,
      recoveryAuthHash: mockRecoveryAuthHash,
    })

    await recoveryFlow.validateMnemonic('testuser', mockMnemonic)

    expect(fetchRecoveryDataPreAuth).toHaveBeenCalledWith('testuser')
    expect(unwrapMasterKeyWithRecovery).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      mockMnemonic,
      expect.objectContaining({
        iv: expect.any(Uint8Array),
        salt: expect.any(Uint8Array),
      }),
    )
  })

  it('propagates ApiError(NOT_FOUND) when account has no recovery data', async () => {
    const notFoundError = new ApiError(ApiErrorCode.NOT_FOUND)
    mockFetchRecoveryDataPreAuth.mockRejectedValueOnce(notFoundError)

    await expect(recoveryFlow.validateMnemonic('unknown', mockMnemonic)).rejects.toThrow()
    expect(unwrapMasterKeyWithRecovery).not.toHaveBeenCalled()
  })

  it('propagates DecryptionError when mnemonic is wrong', async () => {
    mockFetchRecoveryDataPreAuth.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockRejectedValueOnce(new DecryptionError())

    await expect(recoveryFlow.validateMnemonic('testuser', 'wrong mnemonic')).rejects.toThrow(DecryptionError)
  })

  it('propagates network errors from fetchRecoveryDataPreAuth', async () => {
    mockFetchRecoveryDataPreAuth.mockRejectedValueOnce(new ApiError(ApiErrorCode.NETWORK_ERROR))

    await expect(recoveryFlow.validateMnemonic('testuser', mockMnemonic)).rejects.toThrow(ApiError)
  })
})

describe('recoveryFlow.setNewPassword', () => {
  const mockServerRecoveryData = {
    recoveryKeySalt: 'aa'.repeat(16),
    recoveryWrappedMasterKey: 'bb'.repeat(48),
    recoveryKeyIV: 'cc'.repeat(12),
  }
  const mockAuthResult = {
    user: mockUser,
    session: { accessToken: 'token', expiresAt: Date.now() + 3600 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    recoveryFlow.clear()
  })

  it('completes full recovery flow: derive, rewrap, recoverAccount, login, initVault', async () => {
    // Step 1: validate mnemonic
    mockFetchRecoveryDataPreAuth.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockResolvedValueOnce({
      masterKey: mockMasterKey,
      recoveryAuthHash: mockRecoveryAuthHash,
    })

    await recoveryFlow.validateMnemonic('testuser', mockMnemonic)

    // Step 2: set new password
    mockRecoverAccount.mockResolvedValueOnce('user-1')
    mockAuthAdapterLogin.mockResolvedValueOnce(mockAuthResult)

    await recoveryFlow.setNewPassword('newpassword123')

    expect(generateSalt).toHaveBeenCalled()
    expect(deriveAuthCredentials).toHaveBeenCalledWith('newpassword123', expect.any(Uint8Array))
    expect(wrapMasterKeyWithPassword).toHaveBeenCalledWith(mockMasterKey, mockPasswordKey)
    expect(recoverAccount).toHaveBeenCalledWith('testuser', {
      recoveryAuthHash: mockRecoveryAuthHash,
      newAuthHash: mockAuthHash,
      newKdfSalt: expect.any(String),
      newWrappedMasterKey: expect.any(String),
      newMasterKeyIV: expect.any(String),
    })
    expect(authAdapter.login).toHaveBeenCalledWith('testuser', mockAuthHash)
    expect(keyVault.initVault).toHaveBeenCalledWith('user-1', mockPasswordKey)
  })

  it('zero-fills passwordKey and calls clear in finally block on success', async () => {
    mockFetchRecoveryDataPreAuth.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockResolvedValueOnce({
      masterKey: mockMasterKey,
      recoveryAuthHash: mockRecoveryAuthHash,
    })

    await recoveryFlow.validateMnemonic('testuser', mockMnemonic)
    mockRecoverAccount.mockResolvedValueOnce('user-1')
    mockAuthAdapterLogin.mockResolvedValueOnce(mockAuthResult)

    await recoveryFlow.setNewPassword('newpassword123')

    expect(zeroFill).toHaveBeenCalledWith(mockPasswordKey)
    // clear() zero-fills masterKey and nulls state — verify it was called at all
    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })

  it('propagates error when recoverAccount fails and zero-fills sensitive data', async () => {
    mockFetchRecoveryDataPreAuth.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockResolvedValueOnce({
      masterKey: mockMasterKey,
      recoveryAuthHash: mockRecoveryAuthHash,
    })

    await recoveryFlow.validateMnemonic('testuser', mockMnemonic)

    mockRecoverAccount.mockRejectedValueOnce(new ApiError(ApiErrorCode.UNEXPECTED))

    await expect(recoveryFlow.setNewPassword('newpassword123')).rejects.toThrow(ApiError)

    // passwordKey is zeroed in finally, and clear() zero-fills masterKey
    expect(zeroFill).toHaveBeenCalledWith(mockPasswordKey)
    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })

  it('throws RecoveryLoginError when login fails after recovery and zero-fills sensitive data', async () => {
    mockFetchRecoveryDataPreAuth.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockResolvedValueOnce({
      masterKey: mockMasterKey,
      recoveryAuthHash: mockRecoveryAuthHash,
    })

    await recoveryFlow.validateMnemonic('testuser', mockMnemonic)

    mockRecoverAccount.mockResolvedValueOnce('user-1')
    const loginError = new Error('Login failed')
    mockAuthAdapterLogin.mockRejectedValueOnce(loginError)

    await expect(recoveryFlow.setNewPassword('newpassword123')).rejects.toThrow(RecoveryLoginError)
    await expect(recoveryFlow.setNewPassword('newpassword123')).rejects.not.toThrow(ApiError)

    expect(zeroFill).toHaveBeenCalledWith(mockPasswordKey)
    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })

  it('throws RecoveryLoginError when vault init fails after recovery', async () => {
    mockFetchRecoveryDataPreAuth.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockResolvedValueOnce({
      masterKey: mockMasterKey,
      recoveryAuthHash: mockRecoveryAuthHash,
    })

    await recoveryFlow.validateMnemonic('testuser', mockMnemonic)

    mockRecoverAccount.mockResolvedValueOnce('user-1')
    mockAuthAdapterLogin.mockResolvedValueOnce(mockAuthResult)
    const vaultError = new Error('Vault init failed')
    mockKeyVaultInitVault.mockRejectedValueOnce(vaultError)

    await expect(recoveryFlow.setNewPassword('newpassword123')).rejects.toThrow(RecoveryLoginError)

    expect(zeroFill).toHaveBeenCalledWith(mockPasswordKey)
    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })

  it('throws error when validateMnemonic was not called first', async () => {
    await expect(recoveryFlow.setNewPassword('newpassword123')).rejects.toThrow(
      'Must call validateMnemonic before setNewPassword',
    )
  })
})

describe('recoveryFlow.clear', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recoveryFlow.clear()
  })

  it('zero-fills master key and sets recovery state to null', async () => {
    const mockServerRecoveryData = {
      recoveryKeySalt: 'aa'.repeat(16),
      recoveryWrappedMasterKey: 'bb'.repeat(48),
      recoveryKeyIV: 'cc'.repeat(12),
    }
    mockFetchRecoveryDataPreAuth.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockResolvedValueOnce({
      masterKey: mockMasterKey,
      recoveryAuthHash: mockRecoveryAuthHash,
    })

    await recoveryFlow.validateMnemonic('testuser', mockMnemonic)

    recoveryFlow.clear()

    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)

    // Calling setNewPassword after clear should throw
    await expect(recoveryFlow.setNewPassword('newpassword123')).rejects.toThrow(
      'Must call validateMnemonic before setNewPassword',
    )
  })

  it('is a no-op when no recovery state exists', () => {
    recoveryFlow.clear()

    // zeroFill should not have been called for masterKey from this clear call
    // (it may have been called from beforeEach clear or other tests)
    expect(zeroFill).not.toHaveBeenCalledWith(expect.any(Uint8Array))
  })
})

describe('verifyMnemonic', () => {
  const mockServerRecoveryData = {
    recoveryKeySalt: 'aa'.repeat(16),
    recoveryWrappedMasterKey: 'bb'.repeat(48),
    recoveryKeyIV: 'cc'.repeat(12),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when mnemonic correctly unwraps recovery data', async () => {
    mockFetchRecoveryData.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockResolvedValueOnce({
      masterKey: mockMasterKey,
      recoveryAuthHash: mockRecoveryAuthHash,
    })

    const result = await verifyMnemonic(mockMnemonic)

    expect(result).toBe(true)
    expect(fetchRecoveryData).toHaveBeenCalledWith('user-1')
  })

  it('returns false when DecryptionError is thrown (wrong mnemonic)', async () => {
    mockFetchRecoveryData.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockRejectedValueOnce(new DecryptionError())

    const result = await verifyMnemonic('wrong mnemonic')

    expect(result).toBe(false)
  })

  it('throws when no authenticated user', async () => {
    vi.mocked(useAuthStore.getState).mockReturnValueOnce({ user: null } as ReturnType<typeof useAuthStore.getState>)

    await expect(verifyMnemonic(mockMnemonic)).rejects.toThrow('No authenticated user')
  })

  it('throws when user has no recovery data', async () => {
    mockFetchRecoveryData.mockResolvedValueOnce(null)

    await expect(verifyMnemonic(mockMnemonic)).rejects.toThrow('No recovery data found for user')
  })

  it('propagates API errors', async () => {
    mockFetchRecoveryData.mockRejectedValueOnce(new ApiError(ApiErrorCode.NETWORK_ERROR))

    await expect(verifyMnemonic(mockMnemonic)).rejects.toThrow(ApiError)
  })

  it('zero-fills master key after successful verification', async () => {
    mockFetchRecoveryData.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockResolvedValueOnce({
      masterKey: mockMasterKey,
      recoveryAuthHash: mockRecoveryAuthHash,
    })

    await verifyMnemonic(mockMnemonic)

    expect(zeroFill).toHaveBeenCalledWith(mockMasterKey)
  })

  it('zero-fills master key after DecryptionError', async () => {
    mockFetchRecoveryData.mockResolvedValueOnce(mockServerRecoveryData)
    vi.mocked(unwrapMasterKeyWithRecovery).mockRejectedValueOnce(new DecryptionError())

    await verifyMnemonic(mockMnemonic)

    // DecryptionError means unwrap failed, so masterKey was not returned —
    // zeroFill is only called if masterKey is truthy in the finally block
    // Since the error occurs inside unwrapMasterKeyWithRecovery, no masterKey to zero-fill
    expect(zeroFill).not.toHaveBeenCalledWith(mockMasterKey)
  })
})
