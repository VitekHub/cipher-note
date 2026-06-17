import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Hoisted mocks: a controllable Supabase client + channel recorder ---

const ctx = vi.hoisted(() => {
  type Handler = { table: string; cb: (payload: unknown) => void }
  interface ChannelMock {
    handlers: Handler[]
    subscribeCb: ((status: string, error?: Error) => void) | null
    on: ReturnType<typeof vi.fn>
    subscribe: ReturnType<typeof vi.fn>
  }
  const removeChannel = vi.fn()
  let current: ChannelMock | null = null

  const makeChannel = (): ChannelMock => {
    const ch: ChannelMock = { handlers: [], subscribeCb: null, on: vi.fn(), subscribe: vi.fn() }
    ch.on.mockImplementation((_event: string, config: { table: string }, cb: (p: unknown) => void) => {
      ch.handlers.push({ table: config.table, cb })
      return ch
    })
    ch.subscribe.mockImplementation((cb: (status: string, error?: Error) => void) => {
      ch.subscribeCb = cb
      return ch
    })
    return ch
  }

  const client = {
    channel: vi.fn(() => {
      current = makeChannel()
      return current
    }),
    removeChannel,
  }

  return { client, removeChannel, currentRef: () => current }
})

vi.mock('@/shared/api/supabase-client', () => ({ getSupabase: () => ctx.client }))

// --- Import after mocks ---

import { realtimeAdapter } from '@/shared/realtime/supabase-realtime'
import type { RealtimeCallbacks, RealtimeEntryChange } from '@/shared/realtime/realtime.types'
import type { ServerEncryptedField } from '@/shared/types/api.types'

function emit(table: string, payload: unknown): void {
  const ch = ctx.currentRef()
  if (!ch) throw new Error('no current channel')
  const handler = ch.handlers.find((h) => h.table === table)
  if (!handler) throw new Error(`no handler registered for ${table}`)
  handler.cb(payload)
}

function emitStatus(status: string, error?: Error): void {
  const ch = ctx.currentRef()
  if (!ch?.subscribeCb) throw new Error('no subscribe callback')
  ch.subscribeCb(status, error)
}

const USER_ID = 'user-123'

describe('SupabaseRealtimeAdapter', () => {
  let callbacks: RealtimeCallbacks

  beforeEach(() => {
    // Reset the singleton's internal channel from any prior test.
    realtimeAdapter.unsubscribe()
    ctx.removeChannel.mockClear()
    ctx.client.channel.mockClear()

    callbacks = {
      onFieldChange: vi.fn<(fieldName: string, data: ServerEncryptedField) => void>(),
      onEntryChange: vi.fn<(change: RealtimeEntryChange) => void>(),
      onKeyRotation: vi.fn<(fieldName: string, newVersion: number) => void>(),
      onError: vi.fn<(error: Error) => void>(),
    }
  })

  it('registers a per-user channel and resolves the subscription promise', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    expect(ctx.client.channel).toHaveBeenCalledWith(`realtime:user:${USER_ID}`)
    expect(ctx.currentRef()).not.toBeNull()
  })

  it('maps an encrypted_fields INSERT to onFieldChange with a camelCased ServerEncryptedField', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    emit('encrypted_fields', {
      eventType: 'INSERT',
      new: {
        entry_id: 'e1',
        field_name: 'note',
        encrypted_blob: 'deadbeef',
        iv: 'aabb',
        updated_at: '2026-01-01T00:00:00Z',
      },
      old: null,
    })
    expect(callbacks.onFieldChange).toHaveBeenCalledWith('note', {
      entryId: 'e1',
      fieldName: 'note',
      encryptedBlob: 'deadbeef',
      iv: 'aabb',
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('skips encrypted_fields DELETE (no `new` row to sync in Step 27)', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    emit('encrypted_fields', { eventType: 'DELETE', new: null, old: { entry_id: 'e1', field_name: 'note' } })
    expect(callbacks.onFieldChange).not.toHaveBeenCalled()
  })

  it('maps an entries INSERT to onEntryChange', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    emit('entries', { eventType: 'INSERT', new: { id: 'ent-1' }, old: null })
    expect(callbacks.onEntryChange).toHaveBeenCalledWith({ eventType: 'INSERT', entryId: 'ent-1' })
  })

  it('maps an entries DELETE to onEntryChange using the old row', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    emit('entries', { eventType: 'DELETE', new: null, old: { id: 'ent-1' } })
    expect(callbacks.onEntryChange).toHaveBeenCalledWith({ eventType: 'DELETE', entryId: 'ent-1' })
  })

  it('maps a field_keys INSERT to onKeyRotation', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    emit('field_keys', { eventType: 'INSERT', new: { field_name: 'note', version: 2 }, old: null })
    expect(callbacks.onKeyRotation).toHaveBeenCalledWith('note', 2)
  })

  it('calls onError when the channel reports CHANNEL_ERROR', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    const err = new Error('socket died')
    emitStatus('CHANNEL_ERROR', err)
    expect(callbacks.onError).toHaveBeenCalledWith(err)
  })

  it('calls onError with a synthetic error on TIMED_OUT when none is supplied', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    emitStatus('TIMED_OUT')
    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    expect(vi.mocked(callbacks.onError).mock.calls[0][0]).toBeInstanceOf(Error)
  })

  it('does not call onError on SUBSCRIBED', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    emitStatus('SUBSCRIBED')
    expect(callbacks.onError).not.toHaveBeenCalled()
  })

  it('unsubscribe removes the channel and is idempotent', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    const channel = ctx.currentRef()
    realtimeAdapter.unsubscribe()
    expect(ctx.removeChannel).toHaveBeenCalledTimes(1)
    expect(ctx.removeChannel).toHaveBeenCalledWith(channel)
    // second call is a no-op (channel already null)
    realtimeAdapter.unsubscribe()
    expect(ctx.removeChannel).toHaveBeenCalledTimes(1)
  })

  it('subscribe tears down a prior channel before opening a new one', async () => {
    await realtimeAdapter.subscribe(USER_ID, callbacks)
    const first = ctx.currentRef()
    expect(ctx.removeChannel).not.toHaveBeenCalled() // no prior channel to remove

    await realtimeAdapter.subscribe(USER_ID, callbacks)
    expect(ctx.removeChannel).toHaveBeenCalledTimes(1)
    expect(ctx.removeChannel).toHaveBeenCalledWith(first)
    expect(ctx.client.channel).toHaveBeenCalledTimes(2)
  })
})
