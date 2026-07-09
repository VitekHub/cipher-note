import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Hoisted mocks: controllable Supabase client ---

const ctx = vi.hoisted(() => {
  const sendMock = vi.fn()
  const removeChannel = vi.fn()
  let currentChannel: Record<string, unknown> | null = null

  const makeChannel = () => {
    const handlers: Record<string, () => void> = {}
    const channel = {
      on: vi.fn((_event: string, config: { event: string }, cb: () => void) => {
        handlers[config.event] = cb
        return channel
      }),
      subscribe: vi.fn(() => channel),
      send: sendMock,
      _handlers: handlers,
    }
    currentChannel = channel
    return channel
  }

  const client = {
    channel: vi.fn(() => makeChannel()),
    removeChannel,
  }

  return { client, removeChannel, sendMock, currentRef: () => currentChannel }
})

vi.mock('@/shared/api/supabase-client', () => ({ getSupabase: () => ctx.client }))

// --- Import after mocks ---

import { sessionUpdateChannel } from '@/shared/realtime/session-update'

const USER_ID = 'user-123'

describe('SessionUpdateChannel', () => {
  beforeEach(() => {
    sessionUpdateChannel.unsubscribe()
    ctx.removeChannel.mockClear()
    ctx.client.channel.mockClear()
    ctx.sendMock.mockClear()
  })

  describe('subscribe', () => {
    it('creates a per-user broadcast channel', () => {
      const onUpdate = vi.fn()
      sessionUpdateChannel.subscribe(USER_ID, onUpdate)

      expect(ctx.client.channel).toHaveBeenCalledWith(`session-updates:${USER_ID}`)
    })

    it('invokes the callback when a sessions_updated broadcast arrives', () => {
      const onUpdate = vi.fn()
      sessionUpdateChannel.subscribe(USER_ID, onUpdate)

      const channel = ctx.currentRef() as Record<string, Record<string, () => void>>
      const handler = channel._handlers['sessions_updated']
      expect(handler).toBeDefined()

      handler!()
      expect(onUpdate).toHaveBeenCalledTimes(1)
    })

    it('tears down a prior subscription before opening a new one', () => {
      const onUpdate1 = vi.fn()
      const onUpdate2 = vi.fn()

      sessionUpdateChannel.subscribe(USER_ID, onUpdate1)
      const firstChannel = ctx.currentRef()

      sessionUpdateChannel.subscribe(USER_ID, onUpdate2)
      expect(ctx.removeChannel).toHaveBeenCalledTimes(1)
      expect(ctx.removeChannel).toHaveBeenCalledWith(firstChannel)
      expect(ctx.client.channel).toHaveBeenCalledTimes(2)
    })
  })

  describe('broadcastUpdate', () => {
    it('sends a sessions_updated broadcast event on the per-user channel', () => {
      sessionUpdateChannel.broadcastUpdate(USER_ID)

      expect(ctx.client.channel).toHaveBeenCalledWith(`session-updates:${USER_ID}`)
      expect(ctx.sendMock).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'sessions_updated',
        payload: {},
      })
    })
  })

  describe('unsubscribe', () => {
    it('removes the channel and is idempotent', () => {
      sessionUpdateChannel.subscribe(USER_ID, vi.fn())
      const channel = ctx.currentRef()

      sessionUpdateChannel.unsubscribe()
      expect(ctx.removeChannel).toHaveBeenCalledTimes(1)
      expect(ctx.removeChannel).toHaveBeenCalledWith(channel)

      // Second call is a no-op
      sessionUpdateChannel.unsubscribe()
      expect(ctx.removeChannel).toHaveBeenCalledTimes(1)
    })
  })
})
