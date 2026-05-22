import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapSupabaseToAuthResult } from './supabase-adapter'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'

function createMockSupabaseUser(
  overrides: {
    id?: string
    email?: string | null
    created_at?: string
    user_metadata?: Record<string, unknown>
  } = {},
) {
  return {
    id: overrides.id ?? '123e4567-e89b-12d3-a456-426614174000',
    email: overrides.email ?? 'testuser@ciphernote.internal',
    created_at: overrides.created_at ?? '2024-01-01T00:00:00.000Z',
    user_metadata: overrides.user_metadata ?? { username: 'testuser' },
  }
}

function createMockSupabaseSession(
  overrides: {
    access_token?: string
    expires_at?: number
  } = {},
) {
  return {
    access_token: overrides.access_token ?? 'mock-access-token',
    expires_at: overrides.expires_at ?? 1700000000,
  }
}

describe('mapSupabaseToAuthResult', () => {
  it('maps Supabase user and session to AuthResult', () => {
    const user = createMockSupabaseUser()
    const session = createMockSupabaseSession()

    const result = mapSupabaseToAuthResult(user, session)

    expect(result.user.id).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(result.user.username).toBe('testuser')
    expect(result.user.createdAt).toBe('2024-01-01T00:00:00.000Z')
    expect(result.session.accessToken).toBe('mock-access-token')
    expect(result.session.expiresAt).toBe(1700000000)
  })

  it('extracts username from user_metadata when available', () => {
    const user = createMockSupabaseUser({
      user_metadata: { username: 'myuser' },
      email: 'myuser@ciphernote.internal',
    })
    const session = createMockSupabaseSession()

    const result = mapSupabaseToAuthResult(user, session)

    expect(result.user.username).toBe('myuser')
  })

  it('falls back to email local part when user_metadata.username is missing', () => {
    const user = createMockSupabaseUser({
      email: 'alice@ciphernote.internal',
      user_metadata: {},
    })
    const session = createMockSupabaseSession()

    const result = mapSupabaseToAuthResult(user, session)

    expect(result.user.username).toBe('alice')
  })

  it('handles missing expires_at by defaulting to 0', () => {
    const user = createMockSupabaseUser()
    const session = { access_token: 'mock-token' }

    const result = mapSupabaseToAuthResult(user, session)

    expect(result.session.expiresAt).toBe(0)
  })

  it('handles null email with no username in metadata', () => {
    const user = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: null as string | null,
      created_at: '2024-01-01T00:00:00.000Z',
      user_metadata: {},
    }
    const session = createMockSupabaseSession()

    const result = mapSupabaseToAuthResult(user, session)

    expect(result.user.username).toBe('')
  })
})

const mockSignUp = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}))

describe('SupabaseAuthAdapter — signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws UNEXPECTED when session is null', async () => {
    const { authAdapter } = await import('./supabase-adapter')

    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'alice@ciphernote.internal', created_at: '2024-01-01', user_metadata: {} },
        session: null,
      },
      error: null,
    })

    try {
      await authAdapter.signup('alice', 'hash')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).code).toBe(AuthErrorCode.UNEXPECTED)
    }
  })

  it('throws UNEXPECTED when user is null', async () => {
    const { authAdapter } = await import('./supabase-adapter')

    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    })

    try {
      await authAdapter.signup('alice', 'hash')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).code).toBe(AuthErrorCode.UNEXPECTED)
    }
  })

  it('returns AuthResult on successful signup', async () => {
    const { authAdapter } = await import('./supabase-adapter')

    mockSignUp.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          email: 'alice@ciphernote.internal',
          created_at: '2024-01-01T00:00:00.000Z',
          user_metadata: { username: 'alice' },
        },
        session: { access_token: 'token', expires_at: 1700000000 },
      },
      error: null,
    })

    const result = await authAdapter.signup('alice', 'hash')

    expect(result.user.username).toBe('alice')
    expect(result.session.accessToken).toBe('token')
  })
})

describe('SupabaseAuthAdapter — onAuthStateChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('subscribes and returns unsubscribe function', async () => {
    const mockUnsubscribe = vi.fn()
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    })

    const { authAdapter } = await import('./supabase-adapter')

    const unsubscribe = authAdapter.onAuthStateChange(() => {})
    unsubscribe()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('callback maps session to AuthResult', async () => {
    let capturedCallback: ((event: string, session: unknown) => void) | undefined

    mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
      capturedCallback = callback
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      }
    })

    const { authAdapter } = await import('./supabase-adapter')

    const receivedResults: unknown[] = []
    authAdapter.onAuthStateChange((result) => {
      receivedResults.push(result)
    })

    const mockSession = {
      access_token: 'refreshed-token',
      expires_at: 1700001000,
      user: {
        id: 'u1',
        email: 'testuser@ciphernote.internal',
        created_at: '2024-01-01T00:00:00.000Z',
        user_metadata: { username: 'testuser' },
      },
    }
    capturedCallback!('TOKEN_REFRESHED', mockSession)

    expect(receivedResults).toHaveLength(1)
    expect((receivedResults[0] as { user: { username: string } }).user.username).toBe('testuser')
    expect((receivedResults[0] as { session: { accessToken: string } }).session.accessToken).toBe('refreshed-token')
  })

  it('callback calls with null when session is null', async () => {
    let capturedCallback: ((event: string, session: unknown) => void) | undefined

    mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
      capturedCallback = callback
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      }
    })

    const { authAdapter } = await import('./supabase-adapter')

    const receivedResults: unknown[] = []
    authAdapter.onAuthStateChange((result) => {
      receivedResults.push(result)
    })

    capturedCallback!('SIGNED_OUT', null)

    expect(receivedResults).toHaveLength(1)
    expect(receivedResults[0]).toBeNull()
  })
})
