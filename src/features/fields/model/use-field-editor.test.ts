import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useSyncStatusStore } from '@/features/fields/model/sync-status-store'

// --- Hoisted mocks ---

const { mockLoadField, mockSaveField, mockUseAuth } = vi.hoisted(() => ({
  mockLoadField: vi.fn<(userId: string, fieldName: string) => Promise<string | null>>(),
  mockSaveField: vi.fn<(userId: string, fieldName: string, plaintext: string) => Promise<void>>(),
  mockUseAuth: vi.fn<() => { user: { id: string; username: string } | null }>(),
}))

vi.mock('@/features/fields/model/field-service', () => ({
  fieldService: { loadField: mockLoadField, saveField: mockSaveField },
}))

vi.mock('@/shared/auth/auth-context', () => ({
  useAuth: mockUseAuth,
}))

// --- Import after mocks ---

import { useFieldEditor } from '@/features/fields/model/use-field-editor'

const DEBOUNCE_MS = 1000
const SAVED_DISPLAY_MS = 3000

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useFieldEditor', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createQueryClient()
    useCryptoStore.setState({
      loadedFieldKeys: { note: true, website: true, email: true },
      isVaultLocked: false,
      lastActivity: Date.now(),
      cachedEnvelope: null,
    })
    useSyncStatusStore.getState().resetAll()
    mockUseAuth.mockReturnValue({ user: { id: 'user-123', username: 'testuser' } })
    mockLoadField.mockResolvedValue('initial content')
    mockSaveField.mockResolvedValue(undefined)
  })

  afterEach(() => {
    queryClient.clear()
    vi.useRealTimers()
  })

  it('loads initial fieldValue from query data', async () => {
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })
  })

  it('returns empty string when query returns null', async () => {
    mockLoadField.mockResolvedValue(null)
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('')
    })
  })

  it('updates fieldValue immediately on setFieldValue (optimistic)', async () => {
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })

    act(() => {
      result.current.saveFieldValue('new content')
    })

    expect(result.current.fieldValue).toBe('new content')
  })

  it('keeps status idle immediately after setFieldValue', async () => {
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })

    act(() => {
      result.current.saveFieldValue('new content')
    })

    // Status should still be 'idle' immediately after setFieldValue
    // (it will transition to 'saving' only when the debounce fires)
    expect(result.current.fieldSyncStatus).toBe('idle')
  })

  it('sets sync status to error when save fails', async () => {
    mockSaveField.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })

    act(() => {
      result.current.saveFieldValue('new content')
    })

    // Wait for the debounce + mutation to complete
    await waitFor(
      () => {
        expect(result.current.fieldSyncStatus).toBe('error')
      },
      { timeout: 5000 },
    )

    // Draft is preserved on error
    expect(result.current.fieldValue).toBe('new content')
  })

  it('resets draft when vault locks', async () => {
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })

    act(() => {
      result.current.saveFieldValue('edited content')
    })
    expect(result.current.fieldValue).toBe('edited content')

    // Lock vault
    act(() => {
      useCryptoStore.setState({ isVaultLocked: true, loadedFieldKeys: {} })
    })

    // After vault lock, draft is reset and query is disabled
    await waitFor(() => {
      expect(result.current.fieldValue).toBe('')
    })
  })

  it('does not call saveField when userId is empty', async () => {
    mockUseAuth.mockReturnValue({ user: null })
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    // The fieldValue should be empty string since the query is disabled (no user)
    expect(result.current.fieldValue).toBe('')

    act(() => {
      result.current.saveFieldValue('content')
    })

    // Wait a bit to ensure no save is triggered
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(mockSaveField).not.toHaveBeenCalled()
  })

  it('auto-retries save when browser comes back online', async () => {
    mockSaveField.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })

    act(() => {
      result.current.saveFieldValue('offline content')
    })

    // Wait for the debounce + failed mutation
    await waitFor(
      () => {
        expect(result.current.fieldSyncStatus).toBe('error')
      },
      { timeout: 5000 },
    )

    // Reset mock so next call succeeds
    mockSaveField.mockResolvedValue(undefined)

    // Simulate browser coming back online
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    // Wait for retry to succeed
    await waitFor(
      () => {
        expect(result.current.fieldSyncStatus).toBe('saved')
      },
      { timeout: 5000 },
    )

    // First call failed, second call succeeded with latest fieldValue
    expect(mockSaveField).toHaveBeenCalledTimes(2)
    expect(mockSaveField).toHaveBeenLastCalledWith('user-123', 'note', 'offline content')
  })

  it('does not auto-retry on online event when status is not error', async () => {
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })

    // Status is 'idle' — firing online should NOT trigger a save
    expect(result.current.fieldSyncStatus).toBe('idle')

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    // Wait a bit to ensure no save is triggered
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(mockSaveField).not.toHaveBeenCalled()
  })

  it('does not retry on online event after error is resolved', async () => {
    mockSaveField.mockRejectedValueOnce(new Error('Network error')).mockResolvedValue(undefined)
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })

    act(() => {
      result.current.saveFieldValue('offline content')
    })

    // Wait for debounce + failed mutation
    await waitFor(
      () => {
        expect(result.current.fieldSyncStatus).toBe('error')
      },
      { timeout: 5000 },
    )

    // Simulate browser coming back online → retry succeeds
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    // Wait for retry to succeed
    await waitFor(
      () => {
        expect(result.current.fieldSyncStatus).toBe('saved')
      },
      { timeout: 5000 },
    )

    // Fire another online event — should NOT trigger another save
    // (handler checks status imperatively; status is now 'saved', not 'error')
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await new Promise((resolve) => setTimeout(resolve, 100))
    // Only 2 calls: one failed, one succeeded via retry
    expect(mockSaveField).toHaveBeenCalledTimes(2)
  })
})

describe('useFieldEditor (debounce)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    queryClient = createQueryClient()
    useCryptoStore.setState({
      loadedFieldKeys: { note: true, website: true, email: true },
      isVaultLocked: false,
      lastActivity: Date.now(),
      cachedEnvelope: null,
    })
    useSyncStatusStore.getState().resetAll()
    mockUseAuth.mockReturnValue({ user: { id: 'user-123', username: 'testuser' } })
    mockLoadField.mockResolvedValue('initial content')
    mockSaveField.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    queryClient.clear()
  })

  it('debounces saves — rapid setFieldValue calls trigger only one save', async () => {
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    // Wait for initial query to resolve
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    // Rapid keystrokes
    act(() => {
      result.current.saveFieldValue('a')
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    act(() => {
      result.current.saveFieldValue('ab')
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    act(() => {
      result.current.saveFieldValue('abc')
    })

    // Not yet saved, status still idle
    expect(mockSaveField).not.toHaveBeenCalled()
    expect(result.current.fieldSyncStatus).toBe('idle')

    // After debounce period, save fires and status becomes 'saving'
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveField).toHaveBeenCalledTimes(1)
    expect(mockSaveField).toHaveBeenCalledWith('user-123', 'note', 'abc')
  })

  it('sets sync status to saving then saved on success', async () => {
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    // Wait for initial query to resolve
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    act(() => {
      result.current.saveFieldValue('new content')
    })
    // Status is still 'idle' immediately after setFieldValue
    expect(result.current.fieldSyncStatus).toBe('idle')

    // Partway through the debounce period, status is still 'idle'
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.fieldSyncStatus).toBe('idle')

    // Advance past debounce: save fires, status becomes 'saving'
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    // Wait for mutation to settle
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current.fieldSyncStatus).toBe('saved')

    // After SAVED_DISPLAY_MS, auto-transition to idle
    act(() => {
      vi.advanceTimersByTime(SAVED_DISPLAY_MS)
    })
    expect(result.current.fieldSyncStatus).toBe('idle')
  })

  it('retry calls save immediately without debounce', async () => {
    mockSaveField.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useFieldEditor('note'), {
      wrapper: createWrapper(queryClient),
    })

    // Wait for initial query
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    act(() => {
      result.current.saveFieldValue('new content')
    })

    // Advance past debounce to trigger the save (which will fail)
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    // Wait for mutation error to settle
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current.fieldSyncStatus).toBe('error')

    // Reset the mock so next call succeeds
    mockSaveField.mockResolvedValue(undefined)

    // Retry should call save immediately (no debounce)
    act(() => {
      result.current.retrySave()
    })

    // The retry triggers a mutation directly, so we need to wait for it
    await act(async () => {
      vi.advanceTimersByTime(0)
    })

    // Second call (first was the failed one)
    expect(mockSaveField).toHaveBeenCalledTimes(2)
    expect(mockSaveField).toHaveBeenLastCalledWith('user-123', 'note', 'new content')
  })
})
