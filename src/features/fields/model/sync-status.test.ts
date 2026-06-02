import { describe, it, expect, beforeEach } from 'vitest'
import { useSyncStatusStore } from '@/features/fields/model/sync-status'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'

describe('useSyncStatusStore', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetAll()
  })

  it('starts with all fields idle', () => {
    const { status } = useSyncStatusStore.getState()
    FIELD_NAMES.forEach((name) => expect(status[name]).toBe('idle'))
  })

  it('setStatus updates a single field without affecting others', () => {
    useSyncStatusStore.getState().setStatus('note', 'saving')
    const { status } = useSyncStatusStore.getState()
    expect(status.note).toBe('saving')
    expect(status.website).toBe('idle')
    expect(status.email).toBe('idle')
  })

  it('setStatus can transition through the full lifecycle', () => {
    const store = useSyncStatusStore.getState()
    store.setStatus('note', 'saving')
    expect(useSyncStatusStore.getState().status.note).toBe('saving')

    store.setStatus('note', 'saved')
    expect(useSyncStatusStore.getState().status.note).toBe('saved')

    store.setStatus('note', 'idle')
    expect(useSyncStatusStore.getState().status.note).toBe('idle')
  })

  it('setStatus can set error state', () => {
    useSyncStatusStore.getState().setStatus('website', 'error')
    expect(useSyncStatusStore.getState().status.website).toBe('error')
  })

  it('resetField resets a specific field to idle', () => {
    useSyncStatusStore.getState().setStatus('note', 'saving')
    useSyncStatusStore.getState().setStatus('website', 'error')
    useSyncStatusStore.getState().resetField('note')
    const { status } = useSyncStatusStore.getState()
    expect(status.note).toBe('idle')
    expect(status.website).toBe('error')
  })

  it('resetAll resets all fields to idle', () => {
    useSyncStatusStore.getState().setStatus('note', 'saving')
    useSyncStatusStore.getState().setStatus('website', 'saved')
    useSyncStatusStore.getState().setStatus('email', 'error')
    useSyncStatusStore.getState().resetAll()
    const { status } = useSyncStatusStore.getState()
    FIELD_NAMES.forEach((name) => expect(status[name]).toBe('idle'))
  })
})
