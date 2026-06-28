import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSyncStatusStore, SYNC_STATUS } from '@/features/fields/model/sync-status-store'
import { useSaveScheduler } from '@/features/fields/model/use-save-scheduler'

const DEBOUNCE_MS = 1000
const SAVED_DISPLAY_MS = 3000
const ENTRY_ID = 'entry-123'

/** Create a mock saveMutate function that calls onSuccess by default. */
function createMockSaveMutate() {
  const mock =
    vi.fn<(value: string, options?: { onSuccess?: (updatedAt: string) => void; onError?: () => void }) => void>()
  mock.mockImplementation((_value, options) => {
    options?.onSuccess?.('2026-01-01T00:00:00Z')
  })
  return mock
}

describe('useSaveScheduler', () => {
  let mockSaveMutate: ReturnType<typeof createMockSaveMutate>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useSyncStatusStore.getState().resetAll()
    mockSaveMutate = createMockSaveMutate()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces saves — rapid scheduleSave calls trigger only one save', () => {
    const { result } = renderHook(() =>
      useSaveScheduler({
        entryId: ENTRY_ID,
        fieldName: 'note',
        setSyncStatus: useSyncStatusStore.getState().setStatus,
        saveMutate: mockSaveMutate,
        isVaultLocked: false,
      }),
    )

    const status = () => useSyncStatusStore.getState().status[ENTRY_ID]?.['note']

    // Rapid keystrokes
    act(() => {
      result.current.debounceSave('a')
    })
    // Status is DIRTY immediately after debounceSave
    expect(status()).toBe(SYNC_STATUS.DIRTY)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    act(() => {
      result.current.debounceSave('ab')
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    act(() => {
      result.current.debounceSave('abc')
    })

    // Status remains DIRTY through rapid keystrokes
    expect(status()).toBe(SYNC_STATUS.DIRTY)
    // Not yet saved
    expect(mockSaveMutate).not.toHaveBeenCalled()

    // After debounce period, save fires with the latest value
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(mockSaveMutate).toHaveBeenCalledTimes(1)
    expect(mockSaveMutate).toHaveBeenCalledWith(
      'abc',
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
  })

  it('sets sync status to saving then saved on success', () => {
    const setStatus = useSyncStatusStore.getState().setStatus
    const { result } = renderHook(() =>
      useSaveScheduler({
        entryId: ENTRY_ID,
        fieldName: 'note',
        setSyncStatus: setStatus,
        saveMutate: mockSaveMutate,
        isVaultLocked: false,
      }),
    )

    const status = () => useSyncStatusStore.getState().status[ENTRY_ID]?.['note']

    expect(status()).toBeUndefined()

    // Schedule a save
    act(() => {
      result.current.debounceSave('new content')
    })
    // Status is DIRTY immediately after debounceSave
    expect(status()).toBe(SYNC_STATUS.DIRTY)

    // After debounce fires, mockSaveMutate.onSuccess runs synchronously → SAVING → SAVED
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    // SAVING is transient here because the mock calls onSuccess immediately,
    // so we observe SAVED directly
    expect(status()).toBe(SYNC_STATUS.SAVED)

    // After SAVED_DISPLAY_MS, auto-transition to idle
    act(() => {
      vi.advanceTimersByTime(SAVED_DISPLAY_MS)
    })
    expect(status()).toBe(SYNC_STATUS.IDLE)
  })

  it('sets DIRTY status immediately on debounceSave call', () => {
    const setStatus = useSyncStatusStore.getState().setStatus
    const { result } = renderHook(() =>
      useSaveScheduler({
        entryId: ENTRY_ID,
        fieldName: 'note',
        setSyncStatus: setStatus,
        saveMutate: mockSaveMutate,
        isVaultLocked: false,
      }),
    )

    const status = () => useSyncStatusStore.getState().status[ENTRY_ID]?.['note']

    // Call debounceSave but don't advance timers
    act(() => {
      result.current.debounceSave('abc')
    })

    // Status should be DIRTY immediately, without waiting for debounce
    expect(status()).toBe(SYNC_STATUS.DIRTY)
    // Save should not have been called yet
    expect(mockSaveMutate).not.toHaveBeenCalled()
  })

  it('DIRTY transitions to SAVING when debounce fires', () => {
    // Use a mock that does NOT call onSuccess/error, so we can observe SAVING
    const pendingMock =
      vi.fn<(value: string, options?: { onSuccess?: (updatedAt: string) => void; onError?: () => void }) => void>()

    const setStatus = useSyncStatusStore.getState().setStatus
    const { result } = renderHook(() =>
      useSaveScheduler({
        entryId: ENTRY_ID,
        fieldName: 'note',
        setSyncStatus: setStatus,
        saveMutate: pendingMock,
        isVaultLocked: false,
      }),
    )

    const status = () => useSyncStatusStore.getState().status[ENTRY_ID]?.['note']

    act(() => {
      result.current.debounceSave('test content')
    })

    // Immediately after debounceSave, status is DIRTY
    expect(status()).toBe(SYNC_STATUS.DIRTY)

    // After debounce period fires, status transitions to SAVING
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    expect(status()).toBe(SYNC_STATUS.SAVING)
  })

  it('sets sync status to error when save fails', () => {
    const errorMock =
      vi.fn<(value: string, options?: { onSuccess?: (updatedAt: string) => void; onError?: () => void }) => void>()
    errorMock.mockImplementation((_value, options) => {
      options?.onError?.()
    })

    const setStatus = useSyncStatusStore.getState().setStatus
    const { result } = renderHook(() =>
      useSaveScheduler({
        entryId: ENTRY_ID,
        fieldName: 'note',
        setSyncStatus: setStatus,
        saveMutate: errorMock,
        isVaultLocked: false,
      }),
    )

    // Schedule a save that will fail
    act(() => {
      result.current.debounceSave('bad content')
    })
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(useSyncStatusStore.getState().status[ENTRY_ID]['note']).toBe(SYNC_STATUS.ERROR)
  })

  it('retry calls save immediately without debounce', () => {
    // First call fails
    const errorMock = createMockSaveMutate()
    errorMock.mockImplementationOnce((_value, options) => {
      options?.onError?.()
    })

    const setStatus = useSyncStatusStore.getState().setStatus
    const { result } = renderHook(() =>
      useSaveScheduler({
        entryId: ENTRY_ID,
        fieldName: 'note',
        setSyncStatus: setStatus,
        saveMutate: errorMock,
        isVaultLocked: false,
      }),
    )

    // Schedule initial save
    act(() => {
      result.current.debounceSave('new content')
    })
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(errorMock).toHaveBeenCalledTimes(1)

    // Reset mock so next call succeeds
    errorMock.mockImplementation((_value, options) => {
      options?.onSuccess?.('2026-01-01T00:00:00Z')
    })

    // Retry should call save immediately (no debounce)
    act(() => {
      result.current.retrySave()
    })

    expect(errorMock).toHaveBeenCalledTimes(2)
    expect(errorMock).toHaveBeenLastCalledWith(
      'new content',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('clears timers when vault locks', () => {
    const setStatus = useSyncStatusStore.getState().setStatus
    const { rerender } = renderHook(
      ({ isVaultLocked }) =>
        useSaveScheduler({
          entryId: ENTRY_ID,
          fieldName: 'note',
          setSyncStatus: setStatus,
          saveMutate: mockSaveMutate,
          isVaultLocked,
        }),
      { initialProps: { isVaultLocked: false } },
    )

    // Vault locks — timers should be cleared
    rerender({ isVaultLocked: true })

    // Advance timers to verify no pending saves fire
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS * 2)
    })

    expect(mockSaveMutate).not.toHaveBeenCalled()
  })

  it('clears timers on unmount', () => {
    const setStatus = useSyncStatusStore.getState().setStatus
    const { result, unmount } = renderHook(() =>
      useSaveScheduler({
        entryId: ENTRY_ID,
        fieldName: 'note',
        setSyncStatus: setStatus,
        saveMutate: mockSaveMutate,
        isVaultLocked: false,
      }),
    )

    // Schedule a debounced save
    act(() => {
      result.current.debounceSave('content')
    })

    // Unmount before debounce fires
    unmount()

    // Advance timers — save should not fire after unmount
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS * 2)
    })

    expect(mockSaveMutate).not.toHaveBeenCalled()
  })

  it('uses latest saveMutate after rerender', () => {
    const setStatus = useSyncStatusStore.getState().setStatus
    const firstMutate = createMockSaveMutate()
    const secondMutate = createMockSaveMutate()

    const { rerender, result } = renderHook(
      ({ saveMutate }) =>
        useSaveScheduler({
          entryId: ENTRY_ID,
          fieldName: 'note',
          setSyncStatus: setStatus,
          saveMutate,
          isVaultLocked: false,
        }),
      { initialProps: { saveMutate: firstMutate } },
    )

    // Rerender with a new mutate function
    rerender({ saveMutate: secondMutate })

    // Schedule a save and advance past debounce
    act(() => {
      result.current.debounceSave('content')
    })
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    // The second (latest) mutate should be used
    expect(firstMutate).not.toHaveBeenCalled()
    expect(secondMutate).toHaveBeenCalledTimes(1)
  })
})
