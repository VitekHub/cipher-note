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

describe('useNavigationBlocker', () => {
  const ENTRY_ID = 'entry-1'

  beforeEach(() => {
    useSyncStatusStore.getState().resetAll()
    vi.clearAllMocks()
    mockBlockerStatus.mockReturnValue('idle')
  })

  it('does not block when isSaving() returns false (blocker not active)', () => {
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

  it('auto-proceeds immediately if isSaving() returns false when blocker is already active', () => {
    mockBlockerStatus.mockReturnValue('blocked')
    // No saving status set, so isSaving() returns false

    renderHook(() => useNavigationBlocker())

    expect(mockProceed).toHaveBeenCalled()
    expect(mockToastLoading).not.toHaveBeenCalled()
  })

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

    // Unmount should clean up the subscription
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
