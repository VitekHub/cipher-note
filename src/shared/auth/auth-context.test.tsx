import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './auth-context'
import { useAuthStore } from '@/features/auth/model/auth-store'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('auth-context', () => {
  beforeEach(() => {
    useAuthStore.getState().reset()
  })

  it('provides default unauthenticated context', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
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

  it('throws when useAuth is used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')
  })
})
