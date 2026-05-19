import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './auth-context'
import { useAuthStore } from '@/features/auth/model/auth-store'
import type { ReactNode } from 'react'

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}))

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('auth-context', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isRestoringSession: false,
    })
  })

  it('provides default unauthenticated context', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isRestoringSession).toBe(false)
  })

  it('reflects Zustand auth store state', () => {
    const user = { id: '1', username: 'testuser', createdAt: '2024-01-01' }

    act(() => {
      useAuthStore.getState().setUser(user)
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(user)
  })

  it('reflects loading state from store', () => {
    act(() => {
      useAuthStore.getState().setLoading(true)
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isLoading).toBe(true)
  })

  it('reflects isRestoringSession state from store', () => {
    act(() => {
      useAuthStore.getState().setRestoringSession(true)
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isRestoringSession).toBe(true)
  })

  it('provides an adapter in context', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.adapter).toBeDefined()
    expect(typeof result.current.adapter.login).toBe('function')
    expect(typeof result.current.adapter.signup).toBe('function')
    expect(typeof result.current.adapter.logout).toBe('function')
    expect(typeof result.current.adapter.getSession).toBe('function')
    expect(typeof result.current.adapter.recoverPassword).toBe('function')
    expect(typeof result.current.adapter.onAuthStateChange).toBe('function')
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')
  })
})
