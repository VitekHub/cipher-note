import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// --- Hoisted mocks ---

const ctx = vi.hoisted(() => {
  const mockSubscribe = vi.fn<(userId: string, onUpdate: () => void) => void>()
  const mockUnsubscribe = vi.fn<() => void>()
  const mockIsSessionValid = vi.fn<() => Promise<boolean>>()
  const mockLogoutUser = vi.fn<() => Promise<void>>()
  const toastError = vi.fn<(msg: string, options?: unknown) => string | number>()
  let onRevocationCallback: (() => void) | null = null

  // Auth store state — controllable per-test
  const authState = {
    user: { id: 'user-123', username: 'testuser' },
    isRestoringSession: false,
  }

  return {
    mockSubscribe,
    mockUnsubscribe,
    mockIsSessionValid,
    mockLogoutUser,
    toastError,
    authState,
    get onRevocationCallback() {
      return onRevocationCallback
    },
    setOnRevocationCallback(cb: (() => void) | null) {
      onRevocationCallback = cb
    },
  }
})

vi.mock('@/shared/realtime/session-update', () => ({
  sessionUpdateChannel: {
    subscribe: ctx.mockSubscribe,
    unsubscribe: ctx.mockUnsubscribe,
  },
}))

vi.mock('@/shared/api/supabase-session', () => ({
  isSessionValid: ctx.mockIsSessionValid,
}))

vi.mock('@/features/auth/model/auth-service', () => ({
  logoutUser: ctx.mockLogoutUser,
}))

vi.mock('@/shared/auth/use-current-user', () => ({
  useRequiredUserId: () => 'user-123',
}))

vi.mock('sonner', () => ({
  toast: { error: ctx.toastError },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

const mockInvalidateQueries = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  }
})

// Auth store mock — uses shared mutable state so per-test changes are visible
vi.mock('@/features/auth/model/auth-store', () => {
  function useAuthStore(selector: (s: Record<string, unknown>) => unknown) {
    return selector(ctx.authState)
  }
  useAuthStore.getState = () => ctx.authState
  const isAuthenticated = (state: { user: unknown }) => state.user !== null
  return { useAuthStore, isAuthenticated }
})

// --- Import after mocks ---

import { useSessionUpdateListener } from '@/features/auth/model/use-session-update-listener'

describe('useSessionUpdateListener', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx.setOnRevocationCallback(null)

    ctx.mockSubscribe.mockImplementation((_userId, onUpdate) => {
      ctx.setOnRevocationCallback(onUpdate)
    })

    ctx.mockIsSessionValid.mockResolvedValue(true)
    mockInvalidateQueries.mockResolvedValue(undefined)

    // Reset auth state to defaults
    ctx.authState.user = { id: 'user-123', username: 'testuser' }
    ctx.authState.isRestoringSession = false

    addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('subscribes to the session update channel on mount', () => {
    renderHook(() => useSessionUpdateListener())

    expect(ctx.mockSubscribe).toHaveBeenCalledWith('user-123', expect.any(Function))
  })

  it('calls checkSessionValidity on mount', () => {
    renderHook(() => useSessionUpdateListener())

    expect(ctx.mockIsSessionValid).toHaveBeenCalledTimes(1)
  })

  it('registers an online event listener on mount', () => {
    renderHook(() => useSessionUpdateListener())

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
  })

  it('unsubscribes from the channel and removes online listener on unmount', () => {
    const { unmount } = renderHook(() => useSessionUpdateListener())

    unmount()

    expect(ctx.mockUnsubscribe).toHaveBeenCalledTimes(1)
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
  })

  it('does not subscribe when isRestoringSession is true', () => {
    ctx.authState.isRestoringSession = true

    renderHook(() => useSessionUpdateListener())

    expect(ctx.mockSubscribe).not.toHaveBeenCalled()
    expect(ctx.mockIsSessionValid).not.toHaveBeenCalled()
  })

  it('force-logouts when isSessionValid returns false (mount trigger)', async () => {
    ctx.mockIsSessionValid.mockResolvedValue(false)

    renderHook(() => useSessionUpdateListener())

    await vi.waitFor(() => {
      expect(ctx.mockLogoutUser).toHaveBeenCalledTimes(1)
    })

    expect(ctx.toastError).toHaveBeenCalledWith('session.revokedElsewhere')
  })

  it('invalidates session query when isSessionValid returns true', async () => {
    ctx.mockIsSessionValid.mockResolvedValue(true)

    renderHook(() => useSessionUpdateListener())

    await vi.waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    })

    expect(ctx.mockLogoutUser).not.toHaveBeenCalled()
  })

  it('force-logouts when isSessionValid returns false (online event trigger)', async () => {
    ctx.mockIsSessionValid
      .mockResolvedValueOnce(true) // mount check
      .mockResolvedValueOnce(false) // online event check

    renderHook(() => useSessionUpdateListener())

    // Wait for mount check
    await vi.waitFor(() => {
      expect(ctx.mockIsSessionValid).toHaveBeenCalledTimes(1)
    })

    // Find and trigger the online listener
    const onlineListener = addEventListenerSpy.mock.calls.find((call: unknown[]) => call[0] === 'online')?.[1] as
      | (() => void)
      | undefined

    expect(onlineListener).toBeDefined()
    onlineListener!()

    await vi.waitFor(() => {
      expect(ctx.mockLogoutUser).toHaveBeenCalledTimes(1)
    })

    expect(ctx.toastError).toHaveBeenCalledWith('session.revokedElsewhere')
  })

  it('force-logouts when broadcast callback fires and session is invalid', async () => {
    ctx.mockIsSessionValid
      .mockResolvedValueOnce(true) // mount check
      .mockResolvedValueOnce(false) // broadcast check

    renderHook(() => useSessionUpdateListener())

    await vi.waitFor(() => {
      expect(ctx.mockIsSessionValid).toHaveBeenCalledTimes(1)
    })

    // Trigger the broadcast callback
    expect(ctx.onRevocationCallback).not.toBeNull()
    ctx.onRevocationCallback!()

    await vi.waitFor(() => {
      expect(ctx.mockLogoutUser).toHaveBeenCalledTimes(1)
    })

    expect(ctx.toastError).toHaveBeenCalledWith('session.revokedElsewhere')
  })

  it('stays logged in when isSessionValid returns true (revoking client)', async () => {
    ctx.mockIsSessionValid.mockResolvedValue(true)

    renderHook(() => useSessionUpdateListener())

    await vi.waitFor(() => {
      expect(ctx.mockIsSessionValid).toHaveBeenCalledTimes(1)
    })

    expect(ctx.mockLogoutUser).not.toHaveBeenCalled()
    expect(ctx.toastError).not.toHaveBeenCalled()
  })

  it('does not force-logout on network error (silently skips)', async () => {
    ctx.mockIsSessionValid.mockRejectedValue(new TypeError('Failed to fetch'))

    renderHook(() => useSessionUpdateListener())

    await vi.waitFor(() => {
      expect(ctx.mockIsSessionValid).toHaveBeenCalledTimes(1)
    })

    expect(ctx.mockLogoutUser).not.toHaveBeenCalled()
    expect(ctx.toastError).not.toHaveBeenCalled()
  })
})
