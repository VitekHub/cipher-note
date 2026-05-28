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
const mockSetKeys = vi.fn<(fieldKeyNames: string[]) => void>()
const mockSetEnvelope = vi.fn<(envelope: import('@/shared/types/api.types').CachedVaultEnvelope) => void>()

// Mock registration module
vi.mock('@/features/encryption/model/registration', () => ({
  deriveRegistrationKeys: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    authSalt: new Uint8Array(16).fill(0x01),
    keySalt: new Uint8Array(16).fill(0x02),
    kek: createCryptoKeyMock(),
    fieldKeys: new Map([
      ['note', createCryptoKeyMock()],
      ['website', createCryptoKeyMock()],
      ['email', createCryptoKeyMock()],
    ]),
    wrappedMasterKey: new Uint8Array(48).fill(0x05),
    masterKeyIV: new Uint8Array(12).fill(0x06),
    wrappedFieldKeys: [],
    recoveryData: {
      recoverySalt: new Uint8Array(16).fill(0xaa),
      wrappedMasterKey: new Uint8Array(48).fill(0xbb),
      recoveryIV: new Uint8Array(12).fill(0xcc),
    },
    mnemonic: 'word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11',
  }),
}))

// Mock key-vault module
const { mockClearVault } = vi.hoisted(() => ({
  mockClearVault: vi.fn<() => void>(),
}))
vi.mock('@/features/encryption/model/key-vault', () => ({
  keyVault: {
    lockVault: vi.fn<() => void>(),
    storeKey: vi.fn<() => void>(),
    storeFieldKeys: vi.fn<(kek: CryptoKey, fieldKeys: Map<string, CryptoKey>) => void>(),
    clearVault: mockClearVault,
  },
}))

// Mock Supabase registration
vi.mock('@/shared/api/supabase-registration', () => ({
  uploadRegistrationData: vi.fn().mockResolvedValue(undefined),
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
  fetchLoginSalts: vi.fn().mockResolvedValue({
    authSalt: '01'.repeat(16),
    keySalt: '02'.repeat(16),
  }),
  fetchMasterKeyEnvelope: vi.fn().mockResolvedValue(mockEnvelopeData),
  fetchFieldKeys: vi.fn().mockResolvedValue(mockFieldKeysData),
}))

// Mock Split KDF
vi.mock('@/shared/crypto/split-kdf', () => ({
  deriveAuthCredentials: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    passwordKey: new Uint8Array(32).fill(0x07),
    authSalt: new Uint8Array(16).fill(0x01),
    keySalt: new Uint8Array(16).fill(0x02),
  }),
}))

// Mock Argon2id
vi.mock('@/shared/crypto/argon2id', () => ({
  deriveAuthHash: vi.fn().mockResolvedValue('a'.repeat(64)),
  derivePasswordKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x07)),
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

// Mock AES-GCM
vi.mock('@/shared/crypto/aes-gcm', () => ({
  exportKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x04)),
  importKey: vi.fn().mockResolvedValue(createCryptoKeyMock()),
  encrypt: vi.fn(),
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
  setKeys: mockSetKeys,
  setCachedEnvelope: mockSetEnvelope,
  lockVault: vi.fn<() => void>(),
  clearVault: mockClearVault,
}

vi.mock('@/features/encryption/model/crypto-store', () => ({
  useCryptoStore: {
    getState: vi.fn(() => cryptoStoreState),
    setState: vi.fn(),
  },
}))

import {
  signUpUser,
  loginUser,
  logoutUser,
  restoreSession,
  subscribeToAuthChanges,
  unlockVault,
} from '@/app/flows/auth-flow'
import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { fetchLoginSalts, fetchMasterKeyEnvelope, fetchFieldKeys } from '@/shared/api/supabase-keys'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import type { AuthResult } from '@/shared/auth/auth.types'
import { keyVault } from '@/features/encryption/model/key-vault'
import { deriveAuthHash, derivePasswordKey, terminateWorker } from '@/shared/crypto/argon2id'
import { unwrapFieldKeys } from '@/shared/crypto/key-hierarchy'
import { deriveKEK } from '@/shared/crypto/hkdf'
import { decrypt, importKey } from '@/shared/crypto/aes-gcm'
import { DecryptionError } from '@/shared/crypto/errors'

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
    expect(keyVault.storeFieldKeys).toHaveBeenCalledWith(regResult.kek, regResult.fieldKeys)
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

  it('fetches salts, derives auth hash, and authenticates', async () => {
    await loginUser('testuser', 'testpass123')

    expect(fetchLoginSalts).toHaveBeenCalledWith('testuser')
    expect(deriveAuthHash).toHaveBeenCalledWith('testpass123', expect.any(Uint8Array))
    expect(authAdapter.login).toHaveBeenCalledWith('testuser', 'a'.repeat(64))
  })

  it('fetches envelope and field keys after authentication', async () => {
    await loginUser('testuser', 'testpass123')

    expect(fetchMasterKeyEnvelope).toHaveBeenCalledWith('1')
    expect(fetchFieldKeys).toHaveBeenCalledWith('1')
  })

  it('derives KEK from password and envelope, then stores field keys', async () => {
    await loginUser('testuser', 'testpass123')

    expect(derivePasswordKey).toHaveBeenCalledWith('testpass123', expect.any(Uint8Array))
    expect(importKey).toHaveBeenCalled()
    expect(decrypt).toHaveBeenCalled()
    expect(deriveKEK).toHaveBeenCalled()
    expect(unwrapFieldKeys).toHaveBeenCalledWith(mockFieldKeysData, expect.any(Object))
    expect(keyVault.storeFieldKeys).toHaveBeenCalled()
  })

  it('caches envelope data after login', async () => {
    await loginUser('testuser', 'testpass123')
    expect(mockSetEnvelope).toHaveBeenCalledWith({
      ...mockEnvelopeData,
      fieldKeys: mockFieldKeysData,
    })
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

    expect(keyVault.storeFieldKeys).not.toHaveBeenCalled()
    expect(mockSetAuth).not.toHaveBeenCalled()
  })

  it('sets loading false even on failure', async () => {
    vi.mocked(authAdapter.login).mockRejectedValueOnce(new AuthError(AuthErrorCode.INVALID_CREDENTIALS))

    await expect(loginUser('testuser', 'wrongpass')).rejects.toThrow()

    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })

  it('does not populate crypto store when key derivation fails after auth succeeds', async () => {
    vi.mocked(decrypt).mockRejectedValueOnce(new Error('Decryption failed'))

    await expect(loginUser('testuser', 'testpass123')).rejects.toThrow('Decryption failed')

    expect(keyVault.storeFieldKeys).not.toHaveBeenCalled()
    expect(mockSetAuth).not.toHaveBeenCalled()
    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })

  it('does not populate crypto store when fetching keys fails after auth succeeds', async () => {
    vi.mocked(fetchMasterKeyEnvelope).mockRejectedValueOnce(new AuthError(AuthErrorCode.NETWORK_ERROR))

    await expect(loginUser('testuser', 'testpass123')).rejects.toThrow(AuthError)

    expect(keyVault.storeFieldKeys).not.toHaveBeenCalled()
    expect(mockSetAuth).not.toHaveBeenCalled()
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

describe('unlockVault', () => {
  const mockUser = { id: 'user-1', username: 'testuser', createdAt: '' }

  beforeEach(() => {
    vi.clearAllMocks()
    cryptoStoreState.cachedEnvelope = null
    vi.mocked(useAuthStore.getState).mockReturnValue({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
      setRestoringSession: mockSetRestoringSession,
      reset: mockReset,
      isRestoringSession: false,
      user: mockUser,
      session: null,
      isLoading: false,
      setUser: vi.fn(),
      setSession: vi.fn(),
    })
  })

  it('fetches from server and populates vault when no cached envelope', async () => {
    await unlockVault('test-password-123')

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

    await unlockVault('test-password-123')

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

    await unlockVault('test-password-123')

    expect(mockSetEnvelope).not.toHaveBeenCalled()
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

    await expect(unlockVault('test-password-123')).rejects.toThrow('Cannot unlock vault: no authenticated user')
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

    await unlockVault('test-password-123')

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

    await expect(unlockVault('test-password-123')).rejects.toThrow(DecryptionError)
    expect(mockClearVault).toHaveBeenCalled()
    expect(fetchMasterKeyEnvelope).toHaveBeenCalled()
  })

  it('does not retry on non-DecryptionError', async () => {
    cryptoStoreState.cachedEnvelope = {
      ...mockEnvelopeData,
      fieldKeys: mockFieldKeysData,
    }
    vi.mocked(derivePasswordKey).mockRejectedValueOnce(new Error('Some other error'))

    await expect(unlockVault('test-password-123')).rejects.toThrow('Some other error')
    expect(mockClearVault).not.toHaveBeenCalled()
    expect(fetchMasterKeyEnvelope).not.toHaveBeenCalled()
  })
})
