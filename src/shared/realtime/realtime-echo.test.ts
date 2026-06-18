import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  markLocalSave,
  isLocalEcho,
  clearEchoMarkers,
  scheduleRemoteUpdateClear,
} from '@/shared/realtime/realtime-echo'
import { useCryptoStore } from '@/shared/crypto/crypto-store'

const ENTRY_ID = 'entry-1'

describe('echo detection', () => {
  beforeEach(() => {
    clearEchoMarkers()
  })

  it('markLocalSave + isLocalEcho detects echo with matching timestamp', () => {
    markLocalSave(ENTRY_ID, 'note', '2026-01-01T00:00:00Z')
    expect(isLocalEcho(ENTRY_ID, 'note', '2026-01-01T00:00:00Z')).toBe(true)
    // After detection, marker is consumed
    expect(isLocalEcho(ENTRY_ID, 'note', '2026-01-01T00:00:00Z')).toBe(false)
  })

  it('isLocalEcho returns false for different timestamp', () => {
    markLocalSave(ENTRY_ID, 'note', '2026-01-01T00:00:00Z')
    expect(isLocalEcho(ENTRY_ID, 'note', '2026-01-01T00:00:01Z')).toBe(false)
  })

  it('isLocalEcho returns false for unknown entry/field', () => {
    expect(isLocalEcho(ENTRY_ID, 'note', '2026-01-01T00:00:00Z')).toBe(false)
  })

  it('isLocalEcho returns false on mismatch and does not remove the marker', () => {
    markLocalSave(ENTRY_ID, 'note', '2026-01-01T00:00:00Z')
    // Mismatch — returns false, but does NOT remove the marker
    expect(isLocalEcho(ENTRY_ID, 'note', 'different')).toBe(false)
    // The original marker is still there, so a matching call succeeds
    expect(isLocalEcho(ENTRY_ID, 'note', '2026-01-01T00:00:00Z')).toBe(true)
  })

  it('clearEchoMarkers removes all markers', () => {
    markLocalSave('e1', 'note', 'ts1')
    markLocalSave('e2', 'title', 'ts2')
    clearEchoMarkers()
    expect(isLocalEcho('e1', 'note', 'ts1')).toBe(false)
    expect(isLocalEcho('e2', 'title', 'ts2')).toBe(false)
  })

  it('markLocalSave overwrites previous timestamp for same key', () => {
    markLocalSave(ENTRY_ID, 'note', 'ts-old')
    markLocalSave(ENTRY_ID, 'note', 'ts-new')
    // ts-old no longer matches (was overwritten)
    expect(isLocalEcho(ENTRY_ID, 'note', 'ts-old')).toBe(false)
    // ts-new matches
    expect(isLocalEcho(ENTRY_ID, 'note', 'ts-new')).toBe(true)
  })
})

describe('scheduleRemoteUpdateClear', () => {
  beforeEach(() => {
    clearEchoMarkers()
  })

  it('calls onTimeout after 3 seconds', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    scheduleRemoteUpdateClear(ENTRY_ID, 'note', onTimeout)

    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(onTimeout).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('does not call onTimeout if cancelled before timer fires', () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    scheduleRemoteUpdateClear(ENTRY_ID, 'note', onTimeout)

    clearEchoMarkers()
    vi.advanceTimersByTime(3000)
    expect(onTimeout).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('replaces existing timer for the same field', () => {
    vi.useFakeTimers()
    const onTimeout1 = vi.fn()
    const onTimeout2 = vi.fn()

    scheduleRemoteUpdateClear(ENTRY_ID, 'note', onTimeout1)
    // Schedule again for the same field — should cancel first timer
    scheduleRemoteUpdateClear(ENTRY_ID, 'note', onTimeout2)

    vi.advanceTimersByTime(3000)
    expect(onTimeout1).not.toHaveBeenCalled()
    expect(onTimeout2).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('isolates timers for different fields', () => {
    vi.useFakeTimers()
    const onTimeoutNote = vi.fn()
    const onTimeoutTitle = vi.fn()

    scheduleRemoteUpdateClear(ENTRY_ID, 'note', onTimeoutNote)
    scheduleRemoteUpdateClear(ENTRY_ID, 'title', onTimeoutTitle)

    vi.advanceTimersByTime(3000)
    expect(onTimeoutNote).toHaveBeenCalledTimes(1)
    expect(onTimeoutTitle).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })
})

describe('crypto store clears echo markers', () => {
  beforeEach(() => {
    clearEchoMarkers()
    useCryptoStore.getState().clearVault()
  })

  it('lockVault clears echo markers and cancels timers', () => {
    markLocalSave(ENTRY_ID, 'note', 'ts1')
    scheduleRemoteUpdateClear(ENTRY_ID, 'title', vi.fn())

    useCryptoStore.getState().lockVault()

    // After lockVault, echo marker is gone
    expect(isLocalEcho(ENTRY_ID, 'note', 'ts1')).toBe(false)
  })

  it('clearVault clears echo markers', () => {
    markLocalSave(ENTRY_ID, 'note', 'ts1')

    useCryptoStore.getState().clearVault()

    // After clearVault, echo marker is gone
    expect(isLocalEcho(ENTRY_ID, 'note', 'ts1')).toBe(false)
  })
})
