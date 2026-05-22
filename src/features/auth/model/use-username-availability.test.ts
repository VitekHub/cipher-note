import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@/test/utils'
import { useUsernameAvailability } from '@/features/auth/model/use-username-availability'

const mockRpc = vi.fn()

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({ rpc: mockRpc }),
}))

describe('useUsernameAvailability', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('returns idle when username is empty', () => {
    const { result } = renderHook(() => useUsernameAvailability({ username: '' }))
    expect(result.current.status).toBe('idle')
  })

  it('returns idle when username is too short', () => {
    const { result } = renderHook(() => useUsernameAvailability({ username: 'ab' }))
    expect(result.current.status).toBe('idle')
  })

  it('returns idle when username fails pattern validation', () => {
    const { result } = renderHook(() => useUsernameAvailability({ username: 'user@name' }))
    expect(result.current.status).toBe('idle')
  })

  it('returns idle when enabled is false', () => {
    const { result } = renderHook(() => useUsernameAvailability({ username: 'validuser', enabled: false }))
    expect(result.current.status).toBe('idle')
  })

  it('returns checking when a valid username is entered (before debounce settles)', () => {
    const { result, rerender } = renderHook(({ username }) => useUsernameAvailability({ username }), {
      initialProps: { username: '' },
    })

    expect(result.current.status).toBe('idle')

    rerender({ username: 'validuser' })
    expect(result.current.status).toBe('checking')
  })

  it('returns available when RPC returns true after debounce', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const { result, rerender } = renderHook(({ username }) => useUsernameAvailability({ username }), {
      initialProps: { username: '' },
    })

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

    const { result, rerender } = renderHook(({ username }) => useUsernameAvailability({ username }), {
      initialProps: { username: '' },
    })

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

    const { result, rerender } = renderHook(({ username }) => useUsernameAvailability({ username }), {
      initialProps: { username: '' },
    })

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

    const { result, rerender } = renderHook(({ username }) => useUsernameAvailability({ username }), {
      initialProps: { username: '' },
    })

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
