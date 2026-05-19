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
  },
}))

import { authAdapter } from '@/shared/auth/supabase-adapter'
import { deriveCredentials } from '@/shared/crypto/derive-placeholder'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { registerUser, loginUser, logoutUser } from '@/features/auth/model/auth-credentials'

describe('auth-credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, session: null, isLoading: false })
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
})
