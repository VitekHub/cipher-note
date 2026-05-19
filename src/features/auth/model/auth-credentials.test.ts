import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import { useAuthStore } from '@/features/auth/model/auth-store'
import {
  registerUser,
  loginUser,
  logoutUser,
  restoreSession,
  subscribeToAuthChanges,
} from '@/features/auth/model/auth-credentials'

describe('auth-credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isRestoringSession: false,
    })
  })

  describe('registerUser', () => {
    it('derives credentials and calls signup', async () => {
      await registerUser('testuser', 'testpass123')
      expect(deriveCredentials).toHaveBeenCalledWith('testuser', 'testpass123')
      expect(authAdapter.signup).toHaveBeenCalledWith('testuser', 'a'.repeat(64), 'c'.repeat(64))
    })

    it('sets user and session on success', async () => {
      await registerUser('testuser', 'testpass123')
      const state = useAuthStore.getState()
      expect(state.user).toEqual({ id: '1', username: 'test', createdAt: '' })
      expect(state.session).toEqual({ accessToken: 'tok', expiresAt: 0 })
    })

    it('sets loading false after completion', async () => {
      await registerUser('testuser', 'testpass123')
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
