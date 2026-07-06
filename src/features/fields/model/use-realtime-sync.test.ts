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
  const toastInfo = vi.fn<(msg: string, options?: unknown) => string | number>()
  const toastSuccess = vi.fn<(msg: string, options?: unknown) => string | number>()
  const toastError = vi.fn<(msg: string, options?: unknown) => string | number>()
  const mockSyncFieldKeys = vi.fn<(userId: string) => Promise<void>>()
  const mockClearCachedEnvelope = vi.fn<() => void>()
  const cryptoStoreState = { isVaultLocked: false, clearCachedEnvelope: mockClearCachedEnvelope }
  return {
    callbacksRef,
    mockSubscribe,
    mockUnsubscribe,
    toastInfo,
    toastSuccess,
    toastError,
    mockSyncFieldKeys,
    mockClearCachedEnvelope,
    cryptoStoreState,
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

vi.mock('@/shared/crypto/vault/key-vault', () => ({
  keyVault: { syncFieldKeys: ctx.mockSyncFieldKeys },
}))

vi.mock('@/shared/crypto/vault/crypto-store', () => ({
  useCryptoStore: {
    getState: () => ctx.cryptoStoreState,
  },
}))

// --- Import after mocks ---

import { useRealtimeSync } from '@/features/fields/model/use-realtime-sync'
import { useSyncStatusStore, SYNC_STATUS } from '@/features/fields/model/sync-status-store'
import { markLocalSave, markLocalKeyRotation, clearEchoMarkers } from '@/shared/realtime/realtime-echo'
import { queryKeys } from '@/shared/lib/query-keys'
import { DecryptionError } from '@/shared/crypto/core/errors'
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
  ciphertext: 'deadbeef',
  ciphertextIV: 'aabb',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('useRealtimeSync', () => {
  let queryClient: QueryClient
  let invalidateSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx.callbacksRef.current = null
    useSyncStatusStore.getState().resetAll()
    clearEchoMarkers()
    ctx.cryptoStoreState.isVaultLocked = false

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

    callbacks().onFieldChange(FIELD_EVENT)

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.field.detail('e1', 'note') })
    expect(ctx.toastInfo).not.toHaveBeenCalled()
  })

  it('sets remote-update status and invalidates for genuine remote changes', () => {
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onFieldChange(FIELD_EVENT)

    expect(useSyncStatusStore.getState().status['e1']?.['note'] ?? SYNC_STATUS.IDLE).toBe(SYNC_STATUS.REMOTE_UPDATE)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.field.detail('e1', 'note') })
  })

  it('skips invalidation and indicator when isLocalEcho returns true', () => {
    // Mark a local save with the same timestamp as the incoming event
    markLocalSave('e1', 'note', FIELD_EVENT.updatedAt)

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onFieldChange(FIELD_EVENT)

    // Echo should be suppressed entirely — no invalidate, no status, no toast
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(useSyncStatusStore.getState().status['e1']?.['note'] ?? SYNC_STATUS.IDLE).toBe(SYNC_STATUS.IDLE)
    expect(ctx.toastInfo).not.toHaveBeenCalled()
  })

  it('does not suppress when timestamps differ (not an echo)', () => {
    // Mark a local save with a different timestamp
    markLocalSave('e1', 'note', '2025-12-31T23:59:59Z')

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onFieldChange(FIELD_EVENT)

    // Not an echo — should invalidate and set remote-update
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.field.detail('e1', 'note') })
    expect(useSyncStatusStore.getState().status['e1']?.['note'] ?? SYNC_STATUS.IDLE).toBe(SYNC_STATUS.REMOTE_UPDATE)
  })

  it('does not treat a pending save for that field as a conflict if it is an echo', () => {
    // Mark a local save — the echo should be suppressed even if there's also a pending save
    markLocalSave('e1', 'note', FIELD_EVENT.updatedAt)

    // Also seed a pending mutation to test that echo detection takes priority
    const { result: save } = renderHook(() => useNeverResolvingSave(), { wrapper: createWrapper(queryClient) })
    save.current.mutate()

    return waitFor(() => expect(save.current.isPending).toBe(true)).then(() => {
      renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

      callbacks().onFieldChange(FIELD_EVENT)

      // Echo detection should suppress this before the pending-save check
      expect(invalidateSpy).not.toHaveBeenCalled()
    })
  })

  it('skips invalidation when a save for that (entryId, fieldName) is pending (conflict)', async () => {
    // Seed a pending save mutation for queryKeys.field.save('e1', 'note') in the same queryClient.
    const { result: save } = renderHook(() => useNeverResolvingSave(), { wrapper: createWrapper(queryClient) })
    save.current.mutate()
    await waitFor(() => expect(save.current.isPending).toBe(true))

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onFieldChange(FIELD_EVENT)

    // Conflict: no invalidate, no remote-update status
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(useSyncStatusStore.getState().status['e1']?.['note'] ?? SYNC_STATUS.IDLE).toBe(SYNC_STATUS.IDLE)
  })

  it('does not treat a pending save for a different field as a conflict', async () => {
    const { result: save } = renderHook(() => useNeverResolvingSave(), { wrapper: createWrapper(queryClient) })
    save.current.mutate()
    await waitFor(() => expect(save.current.isPending).toBe(true))

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    // Remote change for a DIFFERENT field — should invalidate, not conflict.
    callbacks().onFieldChange({ ...FIELD_EVENT, fieldName: 'title' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.field.detail('e1', 'title') })
    expect(ctx.toastInfo).not.toHaveBeenCalled()
  })

  it('invalidates the entries list on a remote entry change', () => {
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onEntryChange({ eventType: 'INSERT', entryId: 'ent-1' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.entry.list('user-123') })
  })

  it('skips onFieldChange when the vault is locked', () => {
    ctx.cryptoStoreState.isVaultLocked = true

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onFieldChange(FIELD_EVENT)

    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(useSyncStatusStore.getState().status['e1']?.['note'] ?? SYNC_STATUS.IDLE).toBe(SYNC_STATUS.IDLE)
    expect(ctx.toastInfo).not.toHaveBeenCalled()
  })

  it('skips onEntryChange when the vault is locked', () => {
    ctx.cryptoStoreState.isVaultLocked = true

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onEntryChange({ eventType: 'INSERT', entryId: 'ent-1' })

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('clears cached envelope and skips onKeyRotation when the vault is locked', async () => {
    ctx.cryptoStoreState.isVaultLocked = true

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onKeyRotation('note', 2)

    expect(ctx.mockClearCachedEnvelope).toHaveBeenCalledOnce()
    // Give the async IIFE a chance to run (it shouldn't)
    await waitFor(() => {
      expect(ctx.mockSyncFieldKeys).not.toHaveBeenCalled()
    })
    expect(ctx.toastSuccess).not.toHaveBeenCalled()
    expect(ctx.toastError).not.toHaveBeenCalled()
  })

  it('calls syncFieldKeys on key rotation and shows success toast on success', async () => {
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    // onKeyRotation returns void (void IIFE); async work resolves in the background
    callbacks().onKeyRotation('note', 2)

    await waitFor(() => {
      expect(ctx.toastSuccess).toHaveBeenCalledTimes(1)
    })
    expect(ctx.toastSuccess.mock.calls[0][0]).toEqual(expect.any(String))
    // Unlocked vault processes rotation normally — no need to clear cache
    expect(ctx.mockClearCachedEnvelope).not.toHaveBeenCalled()
  })

  it('skips onKeyRotation entirely when it is a local echo', async () => {
    markLocalKeyRotation('note', 2)

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onKeyRotation('note', 2)

    // Give the async IIFE a chance to run (it shouldn't)
    await waitFor(() => {
      expect(ctx.mockSyncFieldKeys).not.toHaveBeenCalled()
    })
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(ctx.toastSuccess).not.toHaveBeenCalled()
    expect(ctx.toastError).not.toHaveBeenCalled()
  })

  it('still toasts when the marker version does not match (not a true echo)', async () => {
    markLocalKeyRotation('note', 3)

    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onKeyRotation('note', 2)

    await waitFor(() => {
      expect(ctx.toastSuccess).toHaveBeenCalledTimes(1)
    })
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

  it('auto-clears remote-update status after 3 seconds', () => {
    vi.useFakeTimers()
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onFieldChange(FIELD_EVENT)

    expect(useSyncStatusStore.getState().status['e1']?.['note']).toBe(SYNC_STATUS.REMOTE_UPDATE)

    vi.advanceTimersByTime(3000)
    expect(useSyncStatusStore.getState().status['e1']?.['note']).toBe(SYNC_STATUS.IDLE)

    vi.useRealTimers()
  })

  it('does not auto-clear remote-update if status changed before timer fires', () => {
    vi.useFakeTimers()
    renderHook(() => useRealtimeSync(), { wrapper: createWrapper(queryClient) })

    callbacks().onFieldChange(FIELD_EVENT)
    // User starts editing before the 3s timer fires
    useSyncStatusStore.getState().setStatus('e1', 'note', SYNC_STATUS.SAVING)

    vi.advanceTimersByTime(3000)
    // saving should not be reset to idle
    expect(useSyncStatusStore.getState().status['e1']?.['note']).toBe(SYNC_STATUS.SAVING)

    vi.useRealTimers()
  })
})
