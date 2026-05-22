import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetLoading = vi.fn()
const mockSetAuth = vi.fn()
const mockSetRestoringSession = vi.fn()
const mockReset = vi.fn()
const mockSetKeys = vi.fn(() => {
  cryptoStoreState.isVaultLocked = false
})

// Mock registration module
vi.mock('@/features/encryption/model/registration', () => ({
  deriveRegistrationKeys: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    authSalt: new Uint8Array(16).fill(0x01),
    keySalt: new Uint8Array(16).fill(0x02),
    masterKey: new Uint8Array(32).fill(0x03),
    kek: new Uint8Array(32).fill(0x04),
    fieldKeys: new Map([
      ['note', new Uint8Array(32).fill(0x10)],
      ['website', new Uint8Array(32).fill(0x20)],
      ['email', new Uint8Array(32).fill(0x30)],
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

// Mock vault-lock module
vi.mock('@/features/encryption/model/vault-lock', () => ({
  lockVault: vi.fn(),
  unlockVault: vi.fn().mockResolvedValue(undefined),
}))

// Mock Supabase registration
vi.mock('@/shared/api/supabase-registration', () => ({
  uploadRegistrationData: vi.fn().mockResolvedValue(undefined),
}))

// Mock Supabase keys
vi.mock('@/shared/api/supabase-keys', () => ({
  getLoginSalts: vi.fn().mockResolvedValue({
    authSalt: '01'.repeat(16),
    keySalt: '02'.repeat(16),
  }),
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

// Mock Split KDF
vi.mock('@/shared/crypto/split-kdf', () => ({
  deriveLoginCredentials: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    passwordKey: new Uint8Array(32).fill(0x07),
  }),
  deriveAuthCredentials: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    passwordKey: new Uint8Array(32).fill(0x07),
    authSalt: new Uint8Array(16).fill(0x01),
    keySalt: new Uint8Array(16).fill(0x02),
  }),
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
  encodeFieldKeysToHex: vi.fn((fieldKeys: Map<string, Uint8Array>) => {
    const result: Record<string, string> = {}
    for (const [name, key] of fieldKeys) {
      result[name] = Array.from(key)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }
    return result
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
  masterKey: null as string | null,
  kek: null as string | null,
  fieldKeys: {} as Record<string, string>,
  isVaultLocked: true,
  lastActivity: 0,
  setKeys: mockSetKeys,
  lockVault: vi.fn(),
}

vi.mock('@/features/encryption/model/crypto-store', () => ({
  useCryptoStore: {
    getState: vi.fn(() => cryptoStoreState),
    setState: vi.fn(),
  },
}))

import { signUpUser, loginUser, logoutUser, restoreSession, subscribeToAuthChanges } from '@/app/flows/auth-flow'
import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { deriveLoginKeys } from '@/features/encryption/model/login'
import { lockVault as lockVaultMock } from '@/features/encryption/model/vault-lock'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { hexEncode } from '@/shared/crypto/memory'
import { exportKey } from '@/shared/crypto/aes-gcm'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { getLoginSalts, getMasterKeyEnvelope, getFieldKeys } from '@/shared/api/supabase-keys'
import { deriveLoginCredentials } from '@/shared/crypto/split-kdf'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'

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

  it('populates crypto store with hex-encoded keys', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(hexEncode).toHaveBeenCalledWith(new Uint8Array(32).fill(0x03))
    expect(hexEncode).toHaveBeenCalledWith(new Uint8Array(32).fill(0x04))
    expect(useCryptoStore.getState().isVaultLocked).toBe(false)
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

  it('fetches salts, derives credentials, and authenticates', async () => {
    await loginUser('testuser', 'testpass123')

    expect(getLoginSalts).toHaveBeenCalledWith('testuser')
    expect(deriveLoginCredentials).toHaveBeenCalledWith('testpass123', expect.any(Uint8Array), expect.any(Uint8Array))
    expect(authAdapter.login).toHaveBeenCalledWith('testuser', 'a'.repeat(64))
  })

  it('fetches keys and field keys after authentication', async () => {
    await loginUser('testuser', 'testpass123')

    expect(getMasterKeyEnvelope).toHaveBeenCalledWith('1')
    expect(getFieldKeys).toHaveBeenCalledWith('1')
  })

  it('calls deriveLoginKeys with passwordKey and decoded key material', async () => {
    await loginUser('testuser', 'testpass123')

    expect(deriveLoginKeys).toHaveBeenCalledWith({
      passwordKey: expect.any(Uint8Array),
      wrappedMasterKey: expect.any(Uint8Array),
      masterKeyIV: expect.any(Uint8Array),
      serverFieldKeys: expect.any(Array),
    })
  })

  it('populates crypto store with hex-encoded keys', async () => {
    await loginUser('testuser', 'testpass123')

    expect(exportKey).toHaveBeenCalled()
    expect(mockSetKeys).toHaveBeenCalled()
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

    expect(mockSetKeys).not.toHaveBeenCalled()
    expect(mockSetAuth).not.toHaveBeenCalled()
  })

  it('sets loading false even on failure', async () => {
    vi.mocked(authAdapter.login).mockRejectedValueOnce(new AuthError(AuthErrorCode.INVALID_CREDENTIALS))

    await expect(loginUser('testuser', 'wrongpass')).rejects.toThrow()

    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })

  it('does not populate crypto store when key unwrapping fails after auth succeeds', async () => {
    vi.mocked(deriveLoginKeys).mockRejectedValueOnce(new Error('Decryption failed'))

    await expect(loginUser('testuser', 'testpass123')).rejects.toThrow('Decryption failed')

    expect(mockSetKeys).not.toHaveBeenCalled()
    expect(mockSetAuth).not.toHaveBeenCalled()
    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })

  it('does not populate crypto store when fetching keys fails after auth succeeds', async () => {
    vi.mocked(getMasterKeyEnvelope).mockRejectedValueOnce(new AuthError(AuthErrorCode.NETWORK_ERROR))

    await expect(loginUser('testuser', 'testpass123')).rejects.toThrow(AuthError)

    expect(mockSetKeys).not.toHaveBeenCalled()
    expect(mockSetAuth).not.toHaveBeenCalled()
  })
})

describe('logoutUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls adapter logout, locks vault, and resets store', async () => {
    await logoutUser()

    expect(authAdapter.logout).toHaveBeenCalled()
    expect(lockVaultMock).toHaveBeenCalled()
    expect(mockReset).toHaveBeenCalled()
  })

  it('locks vault and resets store even when adapter logout fails', async () => {
    vi.mocked(authAdapter.logout).mockRejectedValueOnce(new Error('Network error'))

    await logoutUser()

    expect(lockVaultMock).toHaveBeenCalled()
    expect(mockReset).toHaveBeenCalled()
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
    })

    await restoreSession()
    expect(authAdapter.getSession).not.toHaveBeenCalled()
  })

  it('deduplicates concurrent calls — second call returns early', async () => {
    let resolveGetSession!: (value: unknown) => void
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

  it('callback calls lockVault and reset on null result', () => {
    let capturedCallback: ((result: unknown) => void) | undefined
    vi.mocked(authAdapter.onAuthStateChange).mockImplementation((cb) => {
      capturedCallback = cb as (result: unknown) => void
      return vi.fn()
    })

    subscribeToAuthChanges()
    capturedCallback!(null)

    expect(lockVaultMock).toHaveBeenCalled()
    expect(mockReset).toHaveBeenCalled()
  })
})
