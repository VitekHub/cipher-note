import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSyncStatusStore, useFieldSyncStatus, SYNC_STATUS } from '@/features/fields/model/sync-status-store'

const ENTRY_ID = 'entry-1'

describe('useSyncStatusStore', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetAll()
  })

  it('starts with empty status (no entries)', () => {
    const { status } = useSyncStatusStore.getState()
    expect(Object.keys(status)).toHaveLength(0)
  })

  it('setStatus creates entry-scoped status', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)
    const { status } = useSyncStatusStore.getState()
    expect(status[ENTRY_ID].note).toBe(SYNC_STATUS.SAVING)
  })

  it('setStatus updates a single field without affecting others', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)
    const { status } = useSyncStatusStore.getState()
    expect(status[ENTRY_ID].note).toBe(SYNC_STATUS.SAVING)
    expect(status[ENTRY_ID].website).toBeUndefined()
  })

  it('setStatus can transition through the full lifecycle', () => {
    const store = useSyncStatusStore.getState()
    store.setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)
    expect(useSyncStatusStore.getState().status[ENTRY_ID].note).toBe(SYNC_STATUS.SAVING)

    store.setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVED)
    expect(useSyncStatusStore.getState().status[ENTRY_ID].note).toBe(SYNC_STATUS.SAVED)

    store.setStatus(ENTRY_ID, 'note', SYNC_STATUS.IDLE)
    expect(useSyncStatusStore.getState().status[ENTRY_ID].note).toBe(SYNC_STATUS.IDLE)
  })

  it('setStatus can set error state', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'website', SYNC_STATUS.ERROR)
    expect(useSyncStatusStore.getState().status[ENTRY_ID].website).toBe(SYNC_STATUS.ERROR)
  })

  it('setStatus can set remote-update state', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'title', SYNC_STATUS.REMOTE_UPDATE)
    expect(useSyncStatusStore.getState().status[ENTRY_ID].title).toBe(SYNC_STATUS.REMOTE_UPDATE)
  })

  it('isolates different entries', () => {
    useSyncStatusStore.getState().setStatus('entry-1', 'note', SYNC_STATUS.SAVING)
    useSyncStatusStore.getState().setStatus('entry-2', 'note', SYNC_STATUS.ERROR)
    const { status } = useSyncStatusStore.getState()
    expect(status['entry-1'].note).toBe(SYNC_STATUS.SAVING)
    expect(status['entry-2'].note).toBe(SYNC_STATUS.ERROR)
  })

  it('setStatus with idle resets a specific field', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'website', SYNC_STATUS.ERROR)
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.IDLE)
    const { status } = useSyncStatusStore.getState()
    expect(status[ENTRY_ID].note).toBe(SYNC_STATUS.IDLE)
    expect(status[ENTRY_ID].website).toBe(SYNC_STATUS.ERROR)
  })

  it('resetAll resets all entries to empty', () => {
    useSyncStatusStore.getState().setStatus('entry-1', 'note', SYNC_STATUS.SAVING)
    useSyncStatusStore.getState().setStatus('entry-2', 'website', SYNC_STATUS.SAVED)
    useSyncStatusStore.getState().resetAll()
    const { status } = useSyncStatusStore.getState()
    expect(Object.keys(status)).toHaveLength(0)
  })
})

describe('useFieldSyncStatus', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetAll()
  })

  it('returns idle for untracked entry/field', () => {
    const { result } = renderHook(() => useFieldSyncStatus('nonexistent', 'note'))
    expect(result.current).toBe(SYNC_STATUS.IDLE)
  })

  it('returns current status for tracked entry/field', () => {
    const { result } = renderHook(() => useFieldSyncStatus(ENTRY_ID, 'note'))
    expect(result.current).toBe(SYNC_STATUS.IDLE)

    act(() => {
      useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', SYNC_STATUS.SAVING)
    })
    expect(result.current).toBe(SYNC_STATUS.SAVING)
  })

  it('does not re-render when a different field changes', () => {
    const { result } = renderHook(() => useFieldSyncStatus(ENTRY_ID, 'note'))
    expect(result.current).toBe(SYNC_STATUS.IDLE)

    act(() => {
      useSyncStatusStore.getState().setStatus(ENTRY_ID, 'website', SYNC_STATUS.ERROR)
    })
    // Should still be 'idle' — no re-render for a different field
    expect(result.current).toBe(SYNC_STATUS.IDLE)
  })
})
