import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSyncStatusStore, useFieldSyncStatus } from '@/features/fields/model/sync-status-store'

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
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', 'saving')
    const { status } = useSyncStatusStore.getState()
    expect(status[ENTRY_ID].note).toBe('saving')
  })

  it('setStatus updates a single field without affecting others', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', 'saving')
    const { status } = useSyncStatusStore.getState()
    expect(status[ENTRY_ID].note).toBe('saving')
    expect(status[ENTRY_ID].website).toBeUndefined()
  })

  it('setStatus can transition through the full lifecycle', () => {
    const store = useSyncStatusStore.getState()
    store.setStatus(ENTRY_ID, 'note', 'saving')
    expect(useSyncStatusStore.getState().status[ENTRY_ID].note).toBe('saving')

    store.setStatus(ENTRY_ID, 'note', 'saved')
    expect(useSyncStatusStore.getState().status[ENTRY_ID].note).toBe('saved')

    store.setStatus(ENTRY_ID, 'note', 'idle')
    expect(useSyncStatusStore.getState().status[ENTRY_ID].note).toBe('idle')
  })

  it('setStatus can set error state', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'website', 'error')
    expect(useSyncStatusStore.getState().status[ENTRY_ID].website).toBe('error')
  })

  it('setStatus can set remote-update state', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'title', 'remote-update')
    expect(useSyncStatusStore.getState().status[ENTRY_ID].title).toBe('remote-update')
  })

  it('isolates different entries', () => {
    useSyncStatusStore.getState().setStatus('entry-1', 'note', 'saving')
    useSyncStatusStore.getState().setStatus('entry-2', 'note', 'error')
    const { status } = useSyncStatusStore.getState()
    expect(status['entry-1'].note).toBe('saving')
    expect(status['entry-2'].note).toBe('error')
  })

  it('setStatus with idle resets a specific field', () => {
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', 'saving')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'website', 'error')
    useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', 'idle')
    const { status } = useSyncStatusStore.getState()
    expect(status[ENTRY_ID].note).toBe('idle')
    expect(status[ENTRY_ID].website).toBe('error')
  })

  it('resetAll resets all entries to empty', () => {
    useSyncStatusStore.getState().setStatus('entry-1', 'note', 'saving')
    useSyncStatusStore.getState().setStatus('entry-2', 'website', 'saved')
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
    expect(result.current).toBe('idle')
  })

  it('returns current status for tracked entry/field', () => {
    const { result } = renderHook(() => useFieldSyncStatus(ENTRY_ID, 'note'))
    expect(result.current).toBe('idle')

    act(() => {
      useSyncStatusStore.getState().setStatus(ENTRY_ID, 'note', 'saving')
    })
    expect(result.current).toBe('saving')
  })

  it('does not re-render when a different field changes', () => {
    const { result } = renderHook(() => useFieldSyncStatus(ENTRY_ID, 'note'))
    expect(result.current).toBe('idle')

    act(() => {
      useSyncStatusStore.getState().setStatus(ENTRY_ID, 'website', 'error')
    })
    // Should still be 'idle' — no re-render for a different field
    expect(result.current).toBe('idle')
  })
})
