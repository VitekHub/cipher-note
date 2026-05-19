import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, isAuthenticated } from './auth-store'

describe('auth-store', () => {
  beforeEach(() => {
    useAuthStore.getState().reset()
  })

  it('initializes with default state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  it('selectIsAuthenticated returns false when user is null', () => {
    expect(isAuthenticated(useAuthStore.getState())).toBe(false)
  })

  it('setUser updates user and isAuthenticated is derived', () => {
    const user = { id: '1', username: 'testuser', createdAt: '2024-01-01' }
    useAuthStore.getState().setUser(user)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(isAuthenticated(state)).toBe(true)
  })

  it('setUser with null clears user and isAuthenticated becomes false', () => {
    const user = { id: '1', username: 'testuser', createdAt: '2024-01-01' }
    useAuthStore.getState().setUser(user)
    useAuthStore.getState().setUser(null)

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(isAuthenticated(state)).toBe(false)
  })

  it('setSession updates session', () => {
    const session = { accessToken: 'token-123', expiresAt: 1234567890 }
    useAuthStore.getState().setSession(session)

    expect(useAuthStore.getState().session).toEqual(session)
  })

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)

    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('setAuth updates user and session together', () => {
    const user = { id: '1', username: 'testuser', createdAt: '2024-01-01' }
    const session = { accessToken: 'token-123', expiresAt: 1234567890 }
    useAuthStore.getState().setAuth(user, session)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.session).toEqual(session)
    expect(isAuthenticated(state)).toBe(true)
  })

  it('reset clears all state to defaults', () => {
    const user = { id: '1', username: 'testuser', createdAt: '2024-01-01' }
    const session = { accessToken: 'token-123', expiresAt: 1234567890 }

    useAuthStore.getState().setUser(user)
    useAuthStore.getState().setSession(session)
    useAuthStore.getState().setLoading(true)

    useAuthStore.getState().reset()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(isAuthenticated(state)).toBe(false)
  })
})
