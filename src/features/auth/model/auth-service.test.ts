import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetLoading = vi.fn<(isLoading: boolean) => void>()
const mockSetAuth =
  vi.fn<
    (
      user: import('@/shared/types/entities/user.types').User,
      session: import('@/shared/types/entities/user.types').UserSession,
    ) => void
  >()
const mockSetRestoringSession = vi.fn<(isRestoringSession: boolean) => void>()
const mockReset = vi.fn<() => void>()
const mockSetEnvelope = vi.fn<(envelope: import('@/shared/types/api.types').CachedVaultEnvelope) => void>()

// Mock registration module
vi.mock('@/features/auth/model/registration-crypto', () => ({
  deriveRegistrationKeys: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    vault: {
      kek: {} as CryptoKey,
      fieldKeys: new Map<string, CryptoKey>([
        ['note', {} as CryptoKey],
        ['website', {} as CryptoKey],
        ['email', {} as CryptoKey],
      ]),
    },
    keyEnvelope: {
      authHashSalt: new Uint8Array(16).fill(0x01),
      passwordKeySalt: new Uint8Array(16).fill(0x02),
      wrappedMasterKey: new Uint8Array(48).fill(0x05),
      masterKeyIV: new Uint8Array(12).fill(0x06),
    },
    wrappedFieldKeys: [],
    recovery: {
      recoveryKeySalt: new Uint8Array(16).fill(0xaa),
      recoveryWrappedMasterKey: new Uint8Array(48).fill(0xbb),
      recoveryKeyIV: new Uint8Array(12).fill(0xcc),
      mnemonic: 'word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11',
    },
  }),
}))

// Mock key-vault module
const { mockClearVault } = vi.hoisted(() => ({
  mockClearVault: vi.fn<() => void>(),
}))
vi.mock('@/shared/crypto/key-vault', () => ({
  keyVault: {
    lockVault: vi.fn<() => void>(),
    unlockVault: vi.fn<(userId: string, password: string) => void>(),
    storeKey: vi.fn<() => void>(),
    storeFieldKeys: vi.fn<(fieldKeys: Map<string, CryptoKey>) => void>(),
    clearVault: mockClearVault,
  },
}))

// Mock Supabase registration
vi.mock('@/shared/api/supabase-registration', () => ({
  uploadRegistrationData: vi.fn().mockResolvedValue(undefined),
}))

// Mock Supabase keys
const { mockFetchedEnvelope } = vi.hoisted(() => ({
  mockFetchedEnvelope: {
    authHashSalt: 'f1e2d3c4'.repeat(4),
    passwordKeySalt: 'b5a6g7h8'.repeat(4),
    wrappedMasterKey: 'ff'.repeat(48),
    masterKeyIV: 'ee'.repeat(12),
    fieldKeys: [] as import('@/shared/types/api.types').ServerFieldKey[],
  },
}))

vi.mock('@/shared/api/supabase-keys', () => ({
  fetchLoginSalts: vi.fn().mockResolvedValue({
    authHashSalt: '01'.repeat(16),
    passwordKeySalt: '02'.repeat(16),
  }),
  fetchMasterKeyEnvelope: vi.fn(),
  fetchFieldKeys: vi.fn(),
  fetchFreshEnvelope: vi.fn().mockResolvedValue(mockFetchedEnvelope),
  updateMasterKeyEnvelope: vi.fn().mockResolvedValue(undefined),
}))

// Mock Argon2id
vi.mock('@/shared/crypto/argon2id', () => ({
  terminateWorker: vi.fn(),
}))

// Mock crypto memory
vi.mock('@/shared/crypto/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/crypto-utils')),
  hexEncode: vi.fn((data: Uint8Array) =>
    Array.from(data)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join(''),
  ),
}))

// Mock auth adapter
vi.mock('@/shared/auth/supabase-adapter', () => ({
  authAdapter: {
    signup: vi.fn().mockResolvedValue({
      user: { id: '1', username: 'test', createdAt: '' },
      session: { accessToken: 'tok', expiresAt: 0 },
    }),
    login: vi.fn().mockResolvedValue({
      user: { id: '1', username: 'test', createdAt: '' },
      session: { accessToken: 'tok', expiresAt: 0 },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(null),
    onAuthStateChange: vi.fn().mockReturnValue(vi.fn()),
    updatePassword: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock auth store
vi.mock('@/features/auth/model/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
      setRestoringSession: mockSetRestoringSession,
      reset: mockReset,
      isRestoringSession: false,
    })),
    setState: vi.fn(),
  },
}))

// Mock crypto store
const cryptoStoreState = {
  loadedFieldKeys: {} as Record<string, boolean>,
  isVaultLocked: true,
  lastActivity: 0,
  cachedEnvelope: null as import('@/shared/types/api.types').CachedVaultEnvelope | null,
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

// Mock populateKeyVault
vi.mock('@/shared/crypto/key-vault-service', () => ({
  populateKeyVault: vi.fn().mockResolvedValue(undefined),
}))

// Mock split-kdf (hoisted mock — factory must not reference external variables)
vi.mock('@/shared/crypto/split-kdf', async () => {
  const actual = await vi.importActual<typeof import('@/shared/crypto/split-kdf')>('@/shared/crypto/split-kdf')
  return {
    ...actual,
    deriveAuthHash: vi.fn().mockResolvedValue('a'.repeat(64)),
  }
})

// Mock master-key — rewrapMasterKey is now here
vi.mock('@/shared/crypto/master-key', async () => {
  const actual = await vi.importActual<typeof import('@/shared/crypto/master-key')>('@/shared/crypto/master-key')
  return {
    ...actual,
    rewrapMasterKey: vi.fn().mockResolvedValue({
      newAuthHash: 'newhash'.padEnd(64, '0'),
      newAuthHashSalt: new Uint8Array(16).fill(0x11),
      newPasswordKeySalt: new Uint8Array(16).fill(0x22),
      newWrappedMasterKey: new Uint8Array(48).fill(0x33),
      newMasterKeyIV: new Uint8Array(12).fill(0x44),
    }),
  }
})

import {
  signUpUser,
  loginUser,
  logoutUser,
  restoreSession,
  subscribeToAuthChanges,
  changeUserPassword,
} from '@/features/auth/model/auth-service'
import { deriveRegistrationKeys } from '@/features/auth/model/registration-crypto'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { fetchLoginSalts, updateMasterKeyEnvelope, fetchFreshEnvelope } from '@/shared/api/supabase-keys'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import type { AuthResult } from '@/shared/auth/auth.types'
import { keyVault } from '@/shared/crypto/key-vault'
import { terminateWorker } from '@/shared/crypto/argon2id'
import { rewrapMasterKey } from '@/shared/crypto/master-key'

describe('signUpUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cryptoStoreState.isVaultLocked = true
  })

  it('derives registration keys with password', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(deriveRegistrationKeys).toHaveBeenCalledWith('testpass123')
  })

  it('signs up with auth adapter using username and authHash', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(authAdapter.signup).toHaveBeenCalledWith('testuser', 'a'.repeat(64))
  })

  it('uploads registration data with user ID from signup result', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(uploadRegistrationData).toHaveBeenCalledTimes(1)
    const regResult = await (deriveRegistrationKeys as ReturnType<typeof vi.fn>).mock.results[0].value
    const signupResult = await (authAdapter.signup as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(uploadRegistrationData).toHaveBeenCalledWith(regResult, signupResult.user.id)
  })

  it('stores field keys via keyVault.storeFieldKeys', async () => {
    await signUpUser('testuser', 'testpass123')
    const regResult = await (deriveRegistrationKeys as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(keyVault.storeKey).toHaveBeenCalledWith('kek', regResult.vault.kek)
    expect(keyVault.storeFieldKeys).toHaveBeenCalledWith(regResult.vault.fieldKeys)
  })

  it('caches envelope data after signup', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(mockSetEnvelope).toHaveBeenCalled()
  })

  it('sets auth state on success', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(mockSetAuth).toHaveBeenCalledWith(
      { id: '1', username: 'test', createdAt: '' },
      { accessToken: 'tok', expiresAt: 0 },
    )
  })

  it('sets loading true at start and false on completion', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(mockSetLoading).toHaveBeenCalledWith(true)
    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })

  it('returns mnemonic', async () => {
    const result = await signUpUser('testuser', 'testpass123')
    expect(result).toBe('word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11')
  })

  it('attempts logout cleanup when upload fails after signup succeeds', async () => {
    vi.mocked(uploadRegistrationData).mockRejectedValueOnce(new Error('upload failed'))

    await expect(signUpUser('testuser', 'testpass123')).rejects.toThrow('upload failed')
    expect(authAdapter.logout).toHaveBeenCalledTimes(1)
  })

  it('sets loading false even on failure', async () => {
    vi.mocked(uploadRegistrationData).mockRejectedValueOnce(new Error('upload failed'))

    await expect(signUpUser('testuser', 'testpass123')).rejects.toThrow()
    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })
})

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches salts and authenticates', async () => {
    await loginUser('testuser', 'testpass123')

    expect(fetchLoginSalts).toHaveBeenCalledWith('testuser')
    expect(authAdapter.login).toHaveBeenCalledWith('testuser', 'a'.repeat(64))
  })

  it('populates key vault after authentication', async () => {
    await loginUser('testuser', 'testpass123')

    expect(keyVault.unlockVault).toHaveBeenCalledWith('1', 'testpass123')
  })

  it('sets auth state on success', async () => {
    await loginUser('testuser', 'testpass123')

    expect(mockSetAuth).toHaveBeenCalledWith(
      { id: '1', username: 'test', createdAt: '' },
      { accessToken: 'tok', expiresAt: 0 },
    )
  })

  it('sets loading true at start and false on completion', async () => {
    await loginUser('testuser', 'testpass123')

    expect(mockSetLoading).toHaveBeenCalledWith(true)
    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })

  it('does not populate crypto store when auth fails', async () => {
    vi.mocked(authAdapter.login).mockRejectedValueOnce(new AuthError(AuthErrorCode.INVALID_CREDENTIALS))

    await expect(loginUser('testuser', 'wrongpass')).rejects.toThrow()

    expect(keyVault.unlockVault).not.toHaveBeenCalled()
    expect(mockSetAuth).not.toHaveBeenCalled()
  })

  it('sets loading false even on failure', async () => {
    vi.mocked(authAdapter.login).mockRejectedValueOnce(new AuthError(AuthErrorCode.INVALID_CREDENTIALS))

    await expect(loginUser('testuser', 'wrongpass')).rejects.toThrow()

    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })

  it('does not set auth when populateKeyVault fails after auth succeeds', async () => {
    vi.mocked(keyVault.unlockVault).mockRejectedValueOnce(new Error('Unlock failed'))

    await expect(loginUser('testuser', 'testpass123')).rejects.toThrow('Unlock failed')

    expect(mockSetAuth).not.toHaveBeenCalled()
    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })
})

describe('logoutUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls adapter logout, clears vault, resets store, and terminates worker', async () => {
    await logoutUser()

    expect(authAdapter.logout).toHaveBeenCalled()
    expect(mockClearVault).toHaveBeenCalled()
    expect(mockReset).toHaveBeenCalled()
    expect(terminateWorker).toHaveBeenCalled()
  })

  it('clears vault, resets store, and terminates worker even when adapter logout fails', async () => {
    vi.mocked(authAdapter.logout).mockRejectedValueOnce(new Error('Network error'))

    await logoutUser()

    expect(mockClearVault).toHaveBeenCalled()
    expect(mockReset).toHaveBeenCalled()
    expect(terminateWorker).toHaveBeenCalled()
  })
})

describe('restoreSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authAdapter.getSession).mockResolvedValue(null)
  })

  it('sets isRestoringSession to false after completion', async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
      setRestoringSession: mockSetRestoringSession,
      reset: mockReset,
      isRestoringSession: true,
      user: null,
      session: null,
      isLoading: false,
      setUser: vi.fn(),
      setSession: vi.fn(),
    })

    await restoreSession()
    expect(mockSetRestoringSession).toHaveBeenCalledWith(false)
  })

  it('calls getSession and sets auth on success', async () => {
    vi.mocked(authAdapter.getSession).mockResolvedValue({
      user: { id: '1', username: 'test', createdAt: '' },
      session: { accessToken: 'tok', expiresAt: 0 },
    })
    vi.mocked(useAuthStore.getState).mockReturnValue({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
      setRestoringSession: mockSetRestoringSession,
      reset: mockReset,
      isRestoringSession: true,
      user: null,
      session: null,
      isLoading: false,
      setUser: vi.fn(),
      setSession: vi.fn(),
    })

    await restoreSession()

    expect(authAdapter.getSession).toHaveBeenCalled()
    expect(mockSetAuth).toHaveBeenCalledWith(
      { id: '1', username: 'test', createdAt: '' },
      { accessToken: 'tok', expiresAt: 0 },
    )
  })

  it('sets isRestoringSession to false even when getSession fails', async () => {
    vi.mocked(authAdapter.getSession).mockRejectedValue(new Error('Network error'))
    vi.mocked(useAuthStore.getState).mockReturnValue({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
      setRestoringSession: mockSetRestoringSession,
      reset: mockReset,
      isRestoringSession: true,
      user: null,
      session: null,
      isLoading: false,
      setUser: vi.fn(),
      setSession: vi.fn(),
    })

    await restoreSession()

    expect(mockSetRestoringSession).toHaveBeenCalledWith(false)
  })

  it('is idempotent — no-op when isRestoringSession is false', async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
      setRestoringSession: mockSetRestoringSession,
      reset: mockReset,
      isRestoringSession: false,
      user: null,
      session: null,
      isLoading: false,
      setUser: vi.fn(),
      setSession: vi.fn(),
    })

    await restoreSession()
    expect(authAdapter.getSession).not.toHaveBeenCalled()
  })

  it('deduplicates concurrent calls — second call returns early', async () => {
    let resolveGetSession!: (value: AuthResult | PromiseLike<AuthResult | null> | null) => void
    vi.mocked(authAdapter.getSession).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetSession = resolve
        }),
    )
    vi.mocked(useAuthStore.getState).mockReturnValue({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
      setRestoringSession: mockSetRestoringSession,
      reset: mockReset,
      isRestoringSession: true,
      user: null,
      session: null,
      isLoading: false,
      setUser: vi.fn(),
      setSession: vi.fn(),
    })

    const promise1 = restoreSession()
    await restoreSession() // second call returns early

    expect(authAdapter.getSession).toHaveBeenCalledTimes(1)

    resolveGetSession(null)
    await promise1
  })
})

describe('subscribeToAuthChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('subscribes and returns unsubscribe function', () => {
    const mockUnsubscribe = vi.fn()
    vi.mocked(authAdapter.onAuthStateChange).mockReturnValue(mockUnsubscribe)

    const unsubscribe = subscribeToAuthChanges()
    expect(authAdapter.onAuthStateChange).toHaveBeenCalled()
    unsubscribe()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('callback calls setAuth on auth result', () => {
    let capturedCallback: ((result: unknown) => void) | undefined
    vi.mocked(authAdapter.onAuthStateChange).mockImplementation((cb) => {
      capturedCallback = cb as (result: unknown) => void
      return vi.fn()
    })

    subscribeToAuthChanges()

    const authResult = {
      user: { id: '2', username: 'callbackuser', createdAt: '' },
      session: { accessToken: 'new-tok', expiresAt: 0 },
    }
    capturedCallback!(authResult)

    expect(mockSetAuth).toHaveBeenCalledWith(
      { id: '2', username: 'callbackuser', createdAt: '' },
      { accessToken: 'new-tok', expiresAt: 0 },
    )
  })

  it('callback calls clearVault, reset, and terminateWorker on null result', () => {
    let capturedCallback: ((result: unknown) => void) | undefined
    vi.mocked(authAdapter.onAuthStateChange).mockImplementation((cb) => {
      capturedCallback = cb as (result: unknown) => void
      return vi.fn()
    })

    subscribeToAuthChanges()
    capturedCallback!(null)

    expect(mockClearVault).toHaveBeenCalled()
    expect(mockReset).toHaveBeenCalled()
    expect(terminateWorker).toHaveBeenCalled()
  })
})

describe('changeUserPassword', () => {
  const mockEnvelope = {
    authHashSalt: 'a1b2c3d4'.repeat(4),
    passwordKeySalt: 'e5f6g7h8'.repeat(4),
    wrappedMasterKey: 'aa'.repeat(48),
    masterKeyIV: 'bb'.repeat(12),
    fieldKeys: [],
  }

  const mockChangeResult = {
    newAuthHash: 'newhash'.padEnd(64, '0'),
    newAuthHashSalt: new Uint8Array(16).fill(0x11) as Uint8Array<ArrayBuffer>,
    newPasswordKeySalt: new Uint8Array(16).fill(0x22) as Uint8Array<ArrayBuffer>,
    newWrappedMasterKey: new Uint8Array(48).fill(0x33) as Uint8Array<ArrayBuffer>,
    newMasterKeyIV: new Uint8Array(12).fill(0x44) as Uint8Array<ArrayBuffer>,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset crypto store mock with envelope
    cryptoStoreState.cachedEnvelope = mockEnvelope as unknown as import('@/shared/types/api.types').CachedVaultEnvelope
    // Reset auth store mock with user
    vi.mocked(useAuthStore.getState).mockReturnValue({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
      setRestoringSession: mockSetRestoringSession,
      reset: mockReset,
      isRestoringSession: false,
      user: { id: 'user-1', username: 'testuser', createdAt: '2024-01-01' },
      session: { accessToken: 'tok', expiresAt: 0 },
      setUser: vi.fn(),
      setSession: vi.fn(),
      isLoading: false,
    })
  })

  it('calls rewrapMasterKey with envelope and passwords', async () => {
    vi.mocked(rewrapMasterKey).mockResolvedValueOnce(mockChangeResult)
    vi.mocked(updateMasterKeyEnvelope).mockResolvedValueOnce(undefined)
    vi.mocked(authAdapter.updatePassword).mockResolvedValueOnce(undefined)

    await changeUserPassword('oldPassword', 'newPassword')

    expect(rewrapMasterKey).toHaveBeenCalledWith('oldPassword', 'newPassword', mockEnvelope)
  })

  it('uploads new key envelope to DB', async () => {
    vi.mocked(rewrapMasterKey).mockResolvedValueOnce(mockChangeResult)
    vi.mocked(updateMasterKeyEnvelope).mockResolvedValueOnce(undefined)
    vi.mocked(authAdapter.updatePassword).mockResolvedValueOnce(undefined)

    await changeUserPassword('oldPassword', 'newPassword')

    expect(updateMasterKeyEnvelope).toHaveBeenCalledWith('user-1', {
      authHashSalt: '11111111111111111111111111111111',
      passwordKeySalt: '22222222222222222222222222222222',
      wrappedMasterKey: '33'.repeat(48),
      masterKeyIV: '44'.repeat(12),
    })
  })

  it('updates Supabase Auth password with new auth hash', async () => {
    vi.mocked(rewrapMasterKey).mockResolvedValueOnce(mockChangeResult)
    vi.mocked(updateMasterKeyEnvelope).mockResolvedValueOnce(undefined)
    vi.mocked(authAdapter.updatePassword).mockResolvedValueOnce(undefined)

    await changeUserPassword('oldPassword', 'newPassword')

    expect(authAdapter.updatePassword).toHaveBeenCalledWith(mockChangeResult.newAuthHash)
  })

  it('updates cached envelope after success', async () => {
    vi.mocked(rewrapMasterKey).mockResolvedValueOnce(mockChangeResult)
    vi.mocked(updateMasterKeyEnvelope).mockResolvedValueOnce(undefined)
    vi.mocked(authAdapter.updatePassword).mockResolvedValueOnce(undefined)

    await changeUserPassword('oldPassword', 'newPassword')

    expect(mockSetEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        authHashSalt: '11111111111111111111111111111111',
        passwordKeySalt: '22222222222222222222222222222222',
        wrappedMasterKey: '33'.repeat(48),
        masterKeyIV: '44'.repeat(12),
      }),
    )
  })

  it('throws when no user is authenticated', async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
      setRestoringSession: mockSetRestoringSession,
      reset: mockReset,
      isRestoringSession: false,
      user: null,
      session: null,
      isLoading: false,
      setUser: vi.fn(),
      setSession: vi.fn(),
    })

    await expect(changeUserPassword('oldPassword', 'newPassword')).rejects.toThrow('No authenticated user')
  })

  it('fetches vault envelope when cache is empty', async () => {
    cryptoStoreState.cachedEnvelope = null
    vi.mocked(rewrapMasterKey).mockResolvedValueOnce(mockChangeResult)
    vi.mocked(updateMasterKeyEnvelope).mockResolvedValueOnce(undefined)
    vi.mocked(authAdapter.updatePassword).mockResolvedValueOnce(undefined)

    await changeUserPassword('oldPassword', 'newPassword')

    expect(fetchFreshEnvelope).toHaveBeenCalledWith('user-1')
    expect(rewrapMasterKey).toHaveBeenCalledWith('oldPassword', 'newPassword', mockFetchedEnvelope)
  })

  it('throws when fetchFreshEnvelope fails and no cache exists', async () => {
    cryptoStoreState.cachedEnvelope = null
    vi.mocked(fetchFreshEnvelope).mockRejectedValueOnce(new Error('Network error'))

    await expect(changeUserPassword('oldPassword', 'newPassword')).rejects.toThrow('Network error')
  })

  it('rolls back DB on auth update failure', async () => {
    vi.mocked(rewrapMasterKey).mockResolvedValueOnce(mockChangeResult)
    vi.mocked(updateMasterKeyEnvelope).mockResolvedValueOnce(undefined)
    vi.mocked(authAdapter.updatePassword).mockRejectedValueOnce(new AuthError(AuthErrorCode.NETWORK_ERROR))
    // Rollback call
    vi.mocked(updateMasterKeyEnvelope).mockResolvedValueOnce(undefined)

    await expect(changeUserPassword('oldPassword', 'newPassword')).rejects.toThrow()

    // First call: upload new data; second call: rollback with old data
    expect(updateMasterKeyEnvelope).toHaveBeenCalledTimes(2)
    expect(updateMasterKeyEnvelope).toHaveBeenNthCalledWith(2, 'user-1', {
      authHashSalt: mockEnvelope.authHashSalt,
      passwordKeySalt: mockEnvelope.passwordKeySalt,
      wrappedMasterKey: mockEnvelope.wrappedMasterKey,
      masterKeyIV: mockEnvelope.masterKeyIV,
    })
  })

  it('throws DB error when DB update fails', async () => {
    vi.mocked(rewrapMasterKey).mockResolvedValueOnce(mockChangeResult)
    const dbError = new Error('DB update failed')
    vi.mocked(updateMasterKeyEnvelope).mockRejectedValueOnce(dbError)

    await expect(changeUserPassword('oldPassword', 'newPassword')).rejects.toThrow('DB update failed')
    expect(authAdapter.updatePassword).not.toHaveBeenCalled()
  })
})
