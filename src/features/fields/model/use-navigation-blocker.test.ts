import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSyncStatusStore, SYNC_STATUS } from '@/features/fields/model/sync-status-store'

// Mock @tanstack/react-router
const mockProceed = vi.fn()
const mockBlockerStatus = vi.fn(() => 'idle')

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useBlocker: vi.fn(() => ({
      status: mockBlockerStatus(),
      proceed: mockProceed,
    })),
  }
})

// Mock sonner
const mockToastLoading = vi.fn(() => 'toast-id')
const mockToastDismiss = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    loading: mockToastLoading,
    dismiss: mockToastDismiss,
  },
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

const { useNavigationBlocker } = await import('./use-navigation-blocker')
const { useBlocker } = await import('@tanstack/react-router')

/** Matches the modern UseBlockerOpts shape (the legacy overload lacks these properties). */
type BlockerOpts = {
  shouldBlockFn: (...args: unknown[]) => boolean | Promise<boolean>
  enableBeforeUnload?: boolean | (() => boolean)
  withResolver?: boolean
  disabled?: boolean
}

describe('useNavigationBlocker', () => {
  const ENTRY_ID = 'entry-1'

  beforeEach(() => {
    useSyncStatusStore.getState().resetAll()
    vi.clearAllMocks()
    mockBlockerStatus.mockReturnValue('idle')
  })

  // --- shouldBlock function ---

  it('shouldBlockFn returns false when not saving', () => {
    renderHook(() => useNavigationBlocker())

    const options = vi.mocked(useBlocker).mock.calls.at(-1)![0] as unknown as BlockerOpts
    expect(options.shouldBlockFn()).toBe(false)
  })

  it('shouldBlockFn returns true when saving', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)

    renderHook(() => useNavigationBlocker())

    const options = vi.mocked(useBlocker).mock.calls.at(-1)![0] as unknown as BlockerOpts
    expect(options.shouldBlockFn()).toBe(true)
  })

  it('passes same shouldBlock function for shouldBlockFn and enableBeforeUnload', () => {
    renderHook(() => useNavigationBlocker())

    const options = vi.mocked(useBlocker).mock.calls.at(-1)![0] as unknown as BlockerOpts
    expect(options.shouldBlockFn).toBe(options.enableBeforeUnload)
  })

  // --- Effect behavior ---

  it('does not block when not saving (blocker not active)', () => {
    renderHook(() => useNavigationBlocker())
    expect(mockBlockerStatus()).toBe('idle')
  })

  it('blocks navigation when isSaving() returns true — status becomes blocked', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)

    renderHook(() => useNavigationBlocker())

    expect(mockBlockerStatus()).toBe('blocked')
  })

  it('shows loading toast with i18n key when blocked', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)

    renderHook(() => useNavigationBlocker())

    expect(mockToastLoading).toHaveBeenCalledWith('status.saving', { duration: Infinity })
  })

  // --- Auto-proceed on completion ---

  it('auto-proceeds when saves complete (transition from SAVING to IDLE)', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)

    renderHook(() => useNavigationBlocker())

    expect(mockToastLoading).toHaveBeenCalled()
    expect(mockProceed).not.toHaveBeenCalled()

    act(() => {
      useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.IDLE)
    })

    expect(mockToastDismiss).toHaveBeenCalledWith('toast-id')
    expect(mockProceed).toHaveBeenCalled()
  })

  it('auto-proceeds immediately if not saving when blocker is already active', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    // No saving status set, so isSaving() returns false

    renderHook(() => useNavigationBlocker())

    expect(mockProceed).toHaveBeenCalled()
    expect(mockToastLoading).not.toHaveBeenCalled()
  })

  // --- Paused behavior ---

  it('auto-proceeds immediately when paused (no save in progress)', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.PAUSED)

    renderHook(() => useNavigationBlocker())

    // isSaving() is false, isPaused() is true → proceeds immediately
    expect(mockProceed).toHaveBeenCalled()
    expect(mockToastLoading).not.toHaveBeenCalled()
  })

  it('auto-proceeds when save transitions to PAUSED', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)

    renderHook(() => useNavigationBlocker())

    expect(mockToastLoading).toHaveBeenCalled()
    expect(mockProceed).not.toHaveBeenCalled()

    // Transition to PAUSED — should auto-proceed
    act(() => {
      useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.PAUSED)
    })

    expect(mockToastDismiss).toHaveBeenCalledWith('toast-id')
    expect(mockProceed).toHaveBeenCalled()
  })

  it('unsubscribes from store before proceeding on pause', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)

    renderHook(() => useNavigationBlocker())

    // Transition to PAUSED triggers unsubscribe + proceed
    act(() => {
      useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.PAUSED)
    })

    expect(mockProceed).toHaveBeenCalled()

    // After proceed, further status changes should not trigger another proceed
    mockProceed.mockClear()
    act(() => {
      useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.IDLE)
    })

    expect(mockProceed).not.toHaveBeenCalled()
  })

  // --- Cleanup ---

  it('dismisses toast on cleanup (unmount while blocked)', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)

    const { unmount } = renderHook(() => useNavigationBlocker())

    expect(mockToastLoading).toHaveBeenCalled()

    act(() => {
      unmount()
    })

    expect(mockToastDismiss).toHaveBeenCalledWith('toast-id')
  })

  it('unsubscribes from store on unmount', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)

    const { unmount } = renderHook(() => useNavigationBlocker())

    act(() => {
      unmount()
    })

    // After unmount, changing status should not trigger proceed
    act(() => {
      useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.IDLE)
    })

    expect(mockProceed).not.toHaveBeenCalled()
  })
})
