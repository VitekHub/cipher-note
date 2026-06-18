import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useSyncStatusStore } from '@/features/fields/model/sync-status-store'

// --- Hoisted mocks ---

const { mockLoadField, mockSaveField, mockUseRequiredUserId } = vi.hoisted(() => ({
  mockLoadField: vi.fn<(args: { userId: string; entryId: string; fieldName: string }) => Promise<string | null>>(),
  mockSaveField:
    vi.fn<(args: { userId: string; entryId: string; fieldName: string; plaintext: string }) => Promise<string>>(),
  mockUseRequiredUserId: vi.fn<() => string>(),
}))

vi.mock('@/features/fields/model/field-service', () => ({
  fieldService: { loadField: mockLoadField, saveField: mockSaveField },
}))

vi.mock('@/shared/auth/use-current-user', () => ({
  useRequiredUserId: mockUseRequiredUserId,
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
    mockUseRequiredUserId.mockReturnValue('user-123')
    mockLoadField.mockResolvedValue('initial content')
    mockSaveField.mockResolvedValue('2026-01-01T00:00:00Z')
  })

  afterEach(() => {
    onlineManager.setOnline(true)
    queryClient.clear()
    vi.useRealTimers()
  })

  it('loads initial fieldValue from query data', async () => {
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })
  })

  it('returns empty string when query returns null', async () => {
    mockLoadField.mockResolvedValue(null)
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('')
    })
  })

  it('updates fieldValue immediately on setFieldValue (optimistic)', async () => {
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
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
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
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
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
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
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
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

  it('transitions to paused when offline, then saved when back online', async () => {
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })

    // Go offline — mutations with networkMode: 'online' will pause
    act(() => {
      onlineManager.setOnline(false)
    })

    act(() => {
      result.current.saveFieldValue('offline content')
    })

    // Wait for debounce + mutation pause → status 'paused'
    await waitFor(
      () => {
        expect(result.current.fieldSyncStatus).toBe('paused')
      },
      { timeout: 5000 },
    )

    // saveField was NOT called while offline (mutation paused before calling mutationFn)
    expect(mockSaveField).not.toHaveBeenCalled()

    // Go back online — TanStack Query auto-resumes the paused mutation
    act(() => {
      onlineManager.setOnline(true)
    })

    // Wait for auto-resume to succeed
    await waitFor(
      () => {
        expect(result.current.fieldSyncStatus).toBe('saved')
      },
      { timeout: 5000 },
    )

    expect(mockSaveField).toHaveBeenCalledTimes(1)
    expect(mockSaveField).toHaveBeenCalledWith({
      userId: 'user-123',
      entryId: 'entry-123',
      fieldName: 'note',
      plaintext: 'offline content',
    })
  })

  it('does not auto-retry on online event when status is not error', async () => {
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
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

  it('does not trigger extra save after paused mutation resumes', async () => {
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fieldValue).toBe('initial content')
    })

    // Go offline, save → mutation pauses
    act(() => {
      onlineManager.setOnline(false)
    })
    act(() => {
      result.current.saveFieldValue('offline content')
    })

    await waitFor(
      () => {
        expect(result.current.fieldSyncStatus).toBe('paused')
      },
      { timeout: 5000 },
    )

    // Go back online — auto-resume succeeds
    act(() => {
      onlineManager.setOnline(true)
    })

    await waitFor(
      () => {
        expect(result.current.fieldSyncStatus).toBe('saved')
      },
      { timeout: 5000 },
    )

    // Fire another online event — should NOT trigger another save
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await new Promise((resolve) => setTimeout(resolve, 100))
    // Only one save call (the auto-resumed one)
    expect(mockSaveField).toHaveBeenCalledTimes(1)
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
    mockUseRequiredUserId.mockReturnValue('user-123')
    mockLoadField.mockResolvedValue('initial content')
    mockSaveField.mockResolvedValue('2026-01-01T00:00:00Z')
  })

  afterEach(() => {
    vi.useRealTimers()
    queryClient.clear()
  })

  it('debounces saves — rapid setFieldValue calls trigger only one save', async () => {
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
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
    expect(mockSaveField).toHaveBeenCalledWith({
      userId: 'user-123',
      entryId: 'entry-123',
      fieldName: 'note',
      plaintext: 'abc',
    })
  })

  it('sets sync status to saving then saved on success', async () => {
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
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
    const { result } = renderHook(() => useFieldEditor('entry-123', 'note'), {
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
    mockSaveField.mockResolvedValue('2026-01-01T00:00:00Z')

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
    expect(mockSaveField).toHaveBeenLastCalledWith({
      userId: 'user-123',
      entryId: 'entry-123',
      fieldName: 'note',
      plaintext: 'new content',
    })
  })
})
