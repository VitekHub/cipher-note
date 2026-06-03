import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useCryptoStore } from '@/shared/crypto/crypto-store'

// --- Hoisted mocks ---

const { mockLoadField, mockUseAuth } = vi.hoisted(() => ({
  mockLoadField: vi.fn<(userId: string, fieldName: string) => Promise<string | null>>(),
  mockUseAuth: vi.fn<() => { user: { id: string; username: string } | null }>(),
}))

vi.mock('@/features/fields/model/field-service', () => ({
  fieldService: { loadField: mockLoadField },
}))

vi.mock('@/shared/auth/auth-context', () => ({
  useAuth: mockUseAuth,
}))

// --- Import after mocks ---

import { useFieldQuery } from '@/features/fields/model/use-field-query'

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

describe('useFieldQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: authenticated user, vault unlocked with keys loaded
    mockUseAuth.mockReturnValue({ user: { id: 'user-123', username: 'testuser' } })
    useCryptoStore.setState({
      loadedFieldKeys: { note: true, website: true, email: true },
      isVaultLocked: false,
      lastActivity: Date.now(),
      cachedEnvelope: null,
    })
    mockLoadField.mockResolvedValue('test content')
  })

  it('fetches and returns decrypted field content when vault is unlocked', async () => {
    mockLoadField.mockResolvedValue('My note content')

    const { result } = renderHook(() => useFieldQuery('note'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe('My note content')
    expect(mockLoadField).toHaveBeenCalledWith('user-123', 'note')
  })

  it('returns null when field has never been saved', async () => {
    mockLoadField.mockResolvedValue(null)

    const { result } = renderHook(() => useFieldQuery('note'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })

  it('is disabled when userId is empty (no authenticated user)', () => {
    mockUseAuth.mockReturnValue({ user: null })

    const { result } = renderHook(() => useFieldQuery('note'), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockLoadField).not.toHaveBeenCalled()
  })

  it('is disabled when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true, loadedFieldKeys: {} })

    const { result } = renderHook(() => useFieldQuery('note'), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockLoadField).not.toHaveBeenCalled()
  })

  it('is disabled when field key is not loaded', () => {
    useCryptoStore.setState({ loadedFieldKeys: {} })

    const { result } = renderHook(() => useFieldQuery('note'), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockLoadField).not.toHaveBeenCalled()
  })

  it('is enabled when vault is unlocked and field key is loaded', async () => {
    mockLoadField.mockResolvedValue('hello')

    const { result } = renderHook(() => useFieldQuery('note'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe('hello')
  })

  it('sets error state immediately for DecryptionError (no retry)', async () => {
    const { DecryptionError } = await import('@/shared/crypto/errors')
    mockLoadField.mockRejectedValue(new DecryptionError('Decryption failed'))

    const { result } = renderHook(() => useFieldQuery('note'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(DecryptionError)
    expect(mockLoadField).toHaveBeenCalledTimes(1) // no retry for crypto errors
  })

  it('retries on non-crypto errors before failing', async () => {
    mockLoadField.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useFieldQuery('note'), { wrapper })

    // Allow time for retries with backoff (1s + 2s = ~3s total)
    await waitFor(
      () => {
        expect(result.current.isError).toBe(true)
      },
      { timeout: 5000 },
    )
    // retry: (failureCount, error) => failureCount < 2 → 3 total attempts
    expect(mockLoadField).toHaveBeenCalledTimes(3)
  })
})
