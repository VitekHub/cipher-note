import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useUsernameAvailability } from '@/features/auth/model/use-username-availability'

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
})

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: testQueryClient }, children)
}

afterEach(() => {
  testQueryClient.clear()
})

const mockRpc = vi.fn()

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({ rpc: mockRpc }),
}))

describe('useUsernameAvailability', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('returns idle when username is empty', () => {
    const { result } = renderHook(() => useUsernameAvailability({ username: '' }), { wrapper })
    expect(result.current.status).toBe('idle')
  })

  it('returns idle when username is too short', () => {
    const { result } = renderHook(() => useUsernameAvailability({ username: 'ab' }), { wrapper })
    expect(result.current.status).toBe('idle')
  })

  it('returns idle when username fails pattern validation', () => {
    const { result } = renderHook(() => useUsernameAvailability({ username: 'user@name' }), { wrapper })
    expect(result.current.status).toBe('idle')
  })

  it('returns idle when enabled is false', () => {
    const { result } = renderHook(() => useUsernameAvailability({ username: 'validuser', enabled: false }), { wrapper })
    expect(result.current.status).toBe('idle')
  })

  it('returns checking when a valid username is entered (before debounce settles)', () => {
    const { result, rerender } = renderHook(
      ({ username }: { username: string }) => useUsernameAvailability({ username }),
      {
        wrapper,
        initialProps: { username: '' },
      },
    )

    expect(result.current.status).toBe('idle')

    rerender({ username: 'validuser' })
    expect(result.current.status).toBe('checking')
  })

  it('returns available when RPC returns true after debounce', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const { result, rerender } = renderHook(
      ({ username }: { username: string }) => useUsernameAvailability({ username }),
      {
        wrapper,
        initialProps: { username: '' },
      },
    )

    rerender({ username: 'newuser' })

    await waitFor(
      () => {
        expect(result.current.status).toBe('available')
      },
      { timeout: 3000 },
    )
  })

  it('returns taken when RPC returns false after debounce', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })

    const { result, rerender } = renderHook(
      ({ username }: { username: string }) => useUsernameAvailability({ username }),
      {
        wrapper,
        initialProps: { username: '' },
      },
    )

    rerender({ username: 'takenuser' })

    await waitFor(
      () => {
        expect(result.current.status).toBe('taken')
      },
      { timeout: 3000 },
    )
  })

  it('returns error when RPC throws', async () => {
    mockRpc.mockRejectedValue(new Error('Network error'))

    const { result, rerender } = renderHook(
      ({ username }: { username: string }) => useUsernameAvailability({ username }),
      {
        wrapper,
        initialProps: { username: '' },
      },
    )

    rerender({ username: 'someuser' })

    await waitFor(
      () => {
        expect(result.current.status).toBe('error')
      },
      { timeout: 5000 },
    )
  })

  it('returns checking when username changes after a previous result', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const { result, rerender } = renderHook(
      ({ username }: { username: string }) => useUsernameAvailability({ username }),
      {
        wrapper,
        initialProps: { username: '' },
      },
    )

    rerender({ username: 'user1' })
    await waitFor(
      () => {
        expect(result.current.status).toBe('available')
      },
      { timeout: 3000 },
    )

    rerender({ username: 'user2' })
    expect(result.current.status).toBe('checking')
  })
})