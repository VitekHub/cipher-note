import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('@/features/encryption/model/upload-keys', () => ({
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
    login: vi.fn().mockResolvedValue({
      user: { id: '1', username: 'test', createdAt: '' },
      session: { accessToken: 'tok', expiresAt: 0 },
    }),
    signup: vi.fn().mockResolvedValue({
      user: { id: '1', username: 'test', createdAt: '' },
      session: { accessToken: 'tok', expiresAt: 0 },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(null),
    onAuthStateChange: vi.fn().mockReturnValue(vi.fn()),
  },
}))

import { authAdapter } from '@/shared/auth/supabase-adapter'
import { deriveCredentials } from '@/shared/crypto/derive-placeholder'
import { hexEncode } from '@/shared/crypto/memory'
import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { uploadRegistrationData } from '@/features/encryption/model/upload-keys'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import {
  registerUser,
  loginUser,
  logoutUser,
  restoreSession,
  subscribeToAuthChanges,
} from '@/features/auth/model/auth-credentials'

const MOCK_MNEMONIC = 'word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11'

describe('auth-credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isRestoringSession: false,
    })
    useCryptoStore.setState({
      masterKey: null,
      kek: null,
      fieldKeys: {},
      isVaultLocked: true,
      lastActivity: 0,
    })
  })

  describe('registerUser', () => {
    it('derives registration keys and calls signup', async () => {
      await registerUser('testuser', 'testpass123')
      expect(deriveRegistrationKeys).toHaveBeenCalledWith('testpass123')
      expect(authAdapter.signup).toHaveBeenCalledWith('testuser', 'a'.repeat(64))
    })

    it('uploads registration data with user ID', async () => {
      await registerUser('testuser', 'testpass123')
      expect(uploadRegistrationData).toHaveBeenCalledWith(expect.objectContaining({ authHash: 'a'.repeat(64) }), '1')
    })

    it('sets user and session on success', async () => {
      await registerUser('testuser', 'testpass123')
      const state = useAuthStore.getState()
      expect(state.user).toEqual({ id: '1', username: 'test', createdAt: '' })
      expect(state.session).toEqual({ accessToken: 'tok', expiresAt: 0 })
    })

    it('populates crypto store with hex-encoded keys', async () => {
      await registerUser('testuser', 'testpass123')
      expect(hexEncode).toHaveBeenCalledWith(new Uint8Array(32).fill(0x03))
      expect(hexEncode).toHaveBeenCalledWith(new Uint8Array(32).fill(0x04))

      const cryptoState = useCryptoStore.getState()
      expect(cryptoState.isVaultLocked).toBe(false)
    })

    it('returns mnemonic in result', async () => {
      const result = await registerUser('testuser', 'testpass123')
      expect(result.mnemonic).toBe(MOCK_MNEMONIC)
    })

    it('sets loading false after completion', async () => {
      await registerUser('testuser', 'testpass123')
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it('attempts logout on error after signup', async () => {
      vi.mocked(uploadRegistrationData).mockRejectedValueOnce(new Error('upload failed'))

      await expect(registerUser('testuser', 'testpass123')).rejects.toThrow('upload failed')
      expect(authAdapter.logout).toHaveBeenCalled()
    })

    it('sets loading false after error', async () => {
      vi.mocked(uploadRegistrationData).mockRejectedValueOnce(new Error('upload failed'))

      try {
        await registerUser('testuser', 'testpass123')
      } catch {
        // expected
      }

      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  describe('loginUser', () => {
    it('derives credentials and calls login', async () => {
      await loginUser('testuser', 'testpass123')
      expect(deriveCredentials).toHaveBeenCalledWith('testuser', 'testpass123')
      expect(authAdapter.login).toHaveBeenCalledWith('testuser', 'a'.repeat(64))
    })

    it('sets loading false after completion', async () => {
      await loginUser('testuser', 'testpass123')
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  describe('logoutUser', () => {
    it('calls adapter logout and resets store', async () => {
      useAuthStore.setState({
        user: { id: '1', username: 'test', createdAt: '' },
        session: { accessToken: 'tok', expiresAt: 0 },
      })
      await logoutUser()
      expect(authAdapter.logout).toHaveBeenCalled()
      expect(useAuthStore.getState().user).toBeNull()
    })
  })

  describe('restoreSession', () => {
    beforeEach(() => {
      vi.mocked(authAdapter.getSession).mockResolvedValue(null)
    })

    it('sets isRestoringSession to false after completion', async () => {
      useAuthStore.setState({ isRestoringSession: true })
      await restoreSession()
      expect(useAuthStore.getState().isRestoringSession).toBe(false)
    })

    it('calls getSession and sets auth on success', async () => {
      vi.mocked(authAdapter.getSession).mockResolvedValue({
        user: { id: '1', username: 'test', createdAt: '' },
        session: { accessToken: 'tok', expiresAt: 0 },
      })
      useAuthStore.setState({ isRestoringSession: true })

      await restoreSession()

      expect(authAdapter.getSession).toHaveBeenCalled()
      const state = useAuthStore.getState()
      expect(state.user).toEqual({ id: '1', username: 'test', createdAt: '' })
      expect(state.session).toEqual({ accessToken: 'tok', expiresAt: 0 })
    })

    it('sets isRestoringSession to false even when getSession fails', async () => {
      vi.mocked(authAdapter.getSession).mockRejectedValue(new Error('Network error'))
      useAuthStore.setState({ isRestoringSession: true })

      await restoreSession()

      expect(useAuthStore.getState().isRestoringSession).toBe(false)
      expect(useAuthStore.getState().user).toBeNull()
    })

    it('is idempotent — no-op when isRestoringSession is false', async () => {
      useAuthStore.setState({ isRestoringSession: false })
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
      useAuthStore.setState({ isRestoringSession: true })

      const promise1 = restoreSession()
      await restoreSession() // second call returns early

      expect(authAdapter.getSession).toHaveBeenCalledTimes(1)

      resolveGetSession(null)
      await promise1
    })
  })

  describe('subscribeToAuthChanges', () => {
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

      const state = useAuthStore.getState()
      expect(state.user).toEqual({ id: '2', username: 'callbackuser', createdAt: '' })
    })

    it('callback calls reset on null result', () => {
      let capturedCallback: ((result: unknown) => void) | undefined
      vi.mocked(authAdapter.onAuthStateChange).mockImplementation((cb) => {
        capturedCallback = cb as (result: unknown) => void
        return vi.fn()
      })

      useAuthStore.setState({
        user: { id: '1', username: 'test', createdAt: '' },
        session: { accessToken: 'tok', expiresAt: 0 },
      })

      subscribeToAuthChanges()
      capturedCallback!(null)

      expect(useAuthStore.getState().user).toBeNull()
      expect(useAuthStore.getState().session).toBeNull()
    })
  })
})
