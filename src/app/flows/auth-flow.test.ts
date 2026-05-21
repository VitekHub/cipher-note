import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetLoading = vi.fn()
const mockSetAuth = vi.fn()
const mockSetRestoringSession = vi.fn()
const mockReset = vi.fn()

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

vi.mock('@/shared/api/supabase-registration', () => ({
  uploadRegistrationData: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/shared/crypto/memory', () => ({
  hexEncode: vi.fn((data: Uint8Array) =>
    Array.from(data)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join(''),
  ),
}))

vi.mock('@/shared/crypto/derive-placeholder', () => ({
  deriveCredentials: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    passwordKey: 'b'.repeat(64),
    keySalt: 'c'.repeat(64),
    authSalt: 'd'.repeat(64),
  }),
}))

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

import { signUpUser, loginUser, logoutUser, restoreSession, subscribeToAuthChanges } from '@/app/flows/auth-flow'
import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { hexEncode } from '@/shared/crypto/memory'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'
import { deriveCredentials } from '@/shared/crypto/derive-placeholder'
import { useAuthStore } from '@/features/auth/model/auth-store'

describe('signUpUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCryptoStore.setState({
      masterKey: null,
      kek: null,
      fieldKeys: {},
      isVaultLocked: true,
      lastActivity: 0,
    })
  })

  it('derives registration keys with password', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(deriveRegistrationKeys).toHaveBeenCalledWith('testpass123')
  })

  it('signs up with auth adapter using username and authHash', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(authAdapter.signup).toHaveBeenCalledWith('testuser', 'a'.repeat(64))
  })

  it('uploads registration data with user ID', async () => {
    await signUpUser('testuser', 'testpass123')
    expect(uploadRegistrationData).toHaveBeenCalledTimes(1)
    const regResult = await (deriveRegistrationKeys as ReturnType<typeof vi.fn>).mock.results[0].value
    const userId = '1'
    expect(uploadRegistrationData).toHaveBeenCalledWith(regResult, userId)
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

  it('returns result with mnemonic', async () => {
    const result = await signUpUser('testuser', 'testpass123')
    expect(result.mnemonic).toBe('word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11')
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

  it('derives credentials and calls login', async () => {
    await loginUser('testuser', 'testpass123')
    expect(deriveCredentials).toHaveBeenCalledWith('testuser', 'testpass123')
    expect(authAdapter.login).toHaveBeenCalledWith('testuser', 'a'.repeat(64))
  })

  it('sets loading false after completion', async () => {
    await loginUser('testuser', 'testpass123')
    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })
})

describe('logoutUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls adapter logout and resets store', async () => {
    await logoutUser()
    expect(authAdapter.logout).toHaveBeenCalled()
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

  it('callback calls reset on null result', () => {
    let capturedCallback: ((result: unknown) => void) | undefined
    vi.mocked(authAdapter.onAuthStateChange).mockImplementation((cb) => {
      capturedCallback = cb as (result: unknown) => void
      return vi.fn()
    })

    subscribeToAuthChanges()
    capturedCallback!(null)

    expect(mockReset).toHaveBeenCalled()
  })
})
