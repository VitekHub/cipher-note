import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

// --- Hoisted mocks ---

const ctx = vi.hoisted(() => {
  const callbacksRef = { current: null as import('@/shared/realtime/realtime.types').RealtimeCallbacks | null }
  const mockSubscribe =
    vi.fn<(userId: string, callbacks: import('@/shared/realtime/realtime.types').RealtimeCallbacks) => Promise<void>>()
  const mockUnsubscribe = vi.fn<() => void>()
  const toastInfo = vi.fn<(msg: string, options?: unknown) => void>()
  const toastSuccess = vi.fn<(msg: string, options?: unknown) => void>()
  const toastError = vi.fn<(msg: string, options?: unknown) => void>()
  const mockSyncFieldKeys = vi.fn<(userId: string) => Promise<void>>()
  return {
    callbacksRef,
    mockSubscribe,
    mockUnsubscribe,
    toastInfo,
    toastSuccess,
    toastError,
    mockSyncFieldKeys,
  }
})

vi.mock('@/shared/realtime/supabase-realtime', () => ({
  realtimeAdapter: { subscribe: ctx.mockSubscribe, unsubscribe: ctx.mockUnsubscribe },
}))

vi.mock('@/shared/auth/use-current-user', () => ({
  useRequiredUserId: () => 'user-123',
}))

vi.mock('sonner', () => ({
  toast: { info: ctx.toastInfo, success: ctx.toastSuccess, error: ctx.toastError },
}))

vi.mock('@/shared/crypto/key-vault', () => ({
  keyVault: { syncFieldKeys: ctx.mockSyncFieldKeys },
}))

// --- Import after mocks ---

import { useRealtimeSync } from '@/features/fields/model/use-realtime-sync'
import { queryKeys } from '@/shared/lib/query-keys'
import { DecryptionError } from '@/shared/crypto/errors'
import type { RealtimeCallbacks } from '@/shared/realtime/realtime.types'
import type { ServerEncryptedField } from '@/shared/types/api.types'

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

/** A save mutation that never resolves, so it stays `pending` in the mutation cache. */
function useNeverResolvingSave() {
  return useMutation<void, Error, void>({
    mutationKey: queryKeys.field.save('e1', 'note'),
    mutationFn: () => new Promise<void>(() => {}),
  })
}

const FIELD_EVENT: ServerEncryptedField = {
  entryId: 'e1',
  fieldName: 'note',
  encryptedBlob: 'deadbeef',
  iv: 'aabb',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('useRealtimeSync', () => {
  let queryClient: QueryClient
  let invalidateSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx.callbacksRef.current = null

    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    ctx.mockSubscribe.mockImplementation((_userId, callbacks) => {
      ctx.callbacksRef.current = callbacks
      return Promise.resolve()
    })

    // Default: syncFieldKeys succeeds
    ctx.mockSyncFieldKeys.mockResolvedValue(undefined)
  })

  function callbacks(): RealtimeCallbacks {
    if (!ctx.callbacksRef.current) throw new Error('subscribe was not called')
    return ctx.callbacksRef.current
  }

  it('subscribes on mount and unsubscribes on unmount', () => {
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })
    expect(ctx.mockSubscribe).toHaveBeenCalledTimes(1)
    expect(ctx.mockSubscribe.mock.calls[0][0]).toBe('user-123')
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })
    expect(ctx.mockUnsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(ctx.mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('invalidates the field query on a remote field change when no save is pending', () => {
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onFieldChange('note', FIELD_EVENT)

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.field.detail('e1', 'note') })
    expect(ctx.toastInfo).not.toHaveBeenCalled()
  })

  it('shows an info toast when a save for that (entryId, fieldName) is pending', async () => {
    // Seed a pending save mutation for queryKeys.field.save('e1', 'note') in the same queryClient.
    const { result: save } = renderHook(() => useNeverResolvingSave(), { wrapper: createWrapper(queryClient) })
    save.current.mutate()
    await waitFor(() => expect(save.current.isPending).toBe(true))

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onFieldChange('note', FIELD_EVENT)

    expect(ctx.toastInfo).toHaveBeenCalledTimes(1)
    const [message, options] = ctx.toastInfo.mock.calls[0] as [string, { id: string }]
    expect(message).toEqual(expect.any(String))
    expect(options).toHaveProperty('id')
    expect(options.id).toBe('conflict:e1:note')
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('does not treat a pending save for a different field as a conflict', async () => {
    const { result: save } = renderHook(() => useNeverResolvingSave(), { wrapper: createWrapper(queryClient) })
    save.current.mutate()
    await waitFor(() => expect(save.current.isPending).toBe(true))

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    // Remote change for a DIFFERENT field — should invalidate, not conflict.
    callbacks().onFieldChange('title', { ...FIELD_EVENT, fieldName: 'title' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.field.detail('e1', 'title') })
    expect(ctx.toastInfo).not.toHaveBeenCalled()
  })

  it('invalidates the entries list on a remote entry change', () => {
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onEntryChange({ eventType: 'INSERT', entryId: 'ent-1' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.entry.list('user-123') })
  })

  it('calls syncFieldKeys on key rotation and shows success toast on success', async () => {
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    // onKeyRotation returns void (void IIFE); async work resolves in the background
    callbacks().onKeyRotation('note', 2)

    await waitFor(() => {
      expect(ctx.toastSuccess).toHaveBeenCalledTimes(1)
    })
    expect(ctx.toastSuccess.mock.calls[0][0]).toEqual(expect.any(String))
  })

  it('shows keyRotationFailed toast on DecryptionError (stale KEK)', async () => {
    ctx.mockSyncFieldKeys.mockRejectedValue(new DecryptionError())

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onKeyRotation('note', 2)

    await waitFor(() => {
      expect(ctx.toastError).toHaveBeenCalledTimes(1)
    })
    expect(ctx.toastError.mock.calls[0][0]).toEqual(expect.any(String))
    // keyRotationFailed, not keyRotationNetworkError
    expect(ctx.toastError.mock.calls[0][0]).not.toContain('reconnect')
  })

  it('shows keyRotationNetworkError toast on network error', async () => {
    ctx.mockSyncFieldKeys.mockRejectedValue(new TypeError('Failed to fetch'))

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    // onKeyRotation returns void (void IIFE); async work resolves in the background
    callbacks().onKeyRotation('note', 2)

    await waitFor(() => {
      expect(ctx.toastError).toHaveBeenCalledTimes(1)
    })
    expect(ctx.toastError.mock.calls[0][0]).toEqual(expect.any(String))
    // keyRotationNetworkError, not keyRotationFailed
    expect(ctx.toastError.mock.calls[0][0]).toContain('reconnect')
  })

  it('logs and swallows realtime errors without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    expect(() => callbacks().onError(new Error('boom'))).not.toThrow()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
