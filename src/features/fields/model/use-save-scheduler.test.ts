import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSyncStatusStore } from '@/features/fields/model/sync-status-store'
import { useSaveScheduler } from '@/features/fields/model/use-save-scheduler'

const DEBOUNCE_MS = 1000
const SAVED_DISPLAY_MS = 3000

/** Create a mock saveMutate function that calls onSuccess by default. */
function createMockSaveMutate() {
  const mock = vi.fn<(value: string, options?: { onSuccess?: () => void; onError?: () => void }) => void>()
  mock.mockImplementation((_value, options) => {
    options?.onSuccess?.()
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
      useSaveScheduler('note', useSyncStatusStore.getState().setStatus, mockSaveMutate, false),
    )

    // Rapid keystrokes
    act(() => {
      result.current.debounceSave('a')
    })
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
    const { result } = renderHook(() => useSaveScheduler('note', setStatus, mockSaveMutate, false))

    const status = () => useSyncStatusStore.getState().status['note']

    expect(status()).toBe('idle')

    // Schedule a save
    act(() => {
      result.current.debounceSave('new content')
    })
    // Status is still 'idle' immediately after scheduleSave
    expect(status()).toBe('idle')

    // After debounce fires, mockSaveMutate.onSuccess runs → status becomes 'saved'
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })
    expect(status()).toBe('saved')

    // After SAVED_DISPLAY_MS, auto-transition to idle
    act(() => {
      vi.advanceTimersByTime(SAVED_DISPLAY_MS)
    })
    expect(status()).toBe('idle')
  })

  it('sets sync status to error when save fails', () => {
    const errorMock = vi.fn<(value: string, options?: { onSuccess?: () => void; onError?: () => void }) => void>()
    errorMock.mockImplementation((_value, options) => {
      options?.onError?.()
    })

    const setStatus = useSyncStatusStore.getState().setStatus
    const { result } = renderHook(() => useSaveScheduler('note', setStatus, errorMock, false))

    // Schedule a save that will fail
    act(() => {
      result.current.debounceSave('bad content')
    })
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS)
    })

    expect(useSyncStatusStore.getState().status['note']).toBe('error')
  })

  it('retry calls save immediately without debounce', () => {
    // First call fails
    const errorMock = createMockSaveMutate()
    errorMock.mockImplementationOnce((_value, options) => {
      options?.onError?.()
    })

    const setStatus = useSyncStatusStore.getState().setStatus
    const { result } = renderHook(() => useSaveScheduler('note', setStatus, errorMock, false))

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
      options?.onSuccess?.()
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
      ({ isVaultLocked }) => useSaveScheduler('note', setStatus, mockSaveMutate, isVaultLocked),
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
    const { result, unmount } = renderHook(() => useSaveScheduler('note', setStatus, mockSaveMutate, false))

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
      ({ saveMutate }) => useSaveScheduler('note', setStatus, saveMutate, false),
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
