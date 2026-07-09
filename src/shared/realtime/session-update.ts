import { getSupabase } from '@/shared/api/supabase-client'

// Inferred from the singleton client so we don't depend on a specific realtime type export.
type RealtimeChannel = ReturnType<ReturnType<typeof getSupabase>['channel']>

const SESSIONS_UPDATED_EVENT = 'sessions_updated'

/**
 * Broadcast channel for cross-device session update notifications.
 *
 * When a session is added or revoked, broadcasts a signal on a per-user
 * channel. Subscribers check their own validity (force-logout if revoked)
 * and refresh the active sessions query. Payload is intentionally empty —
 * the database is the source of truth.
 */
class SessionUpdateChannel {
  private channel: RealtimeChannel | null = null

  /**
   * Subscribe to session update broadcasts for the given user.
   * Calls `onUpdate` whenever a session is added or revoked.
   */
  subscribe(userId: string, onUpdate: () => void): void {
    // Defensive: tear down any prior subscription before opening a new one.
    this.unsubscribe()

    const supabase = getSupabase()

    this.channel = supabase
      .channel(`session-updates:${userId}`)
      .on('broadcast', { event: SESSIONS_UPDATED_EVENT }, () => {
        onUpdate()
      })
      .subscribe()
  }

  /**
   * Broadcast a session update signal to other devices.
   * Fire-and-forget: the sender does not await delivery confirmation.
   */
  broadcastUpdate(userId: string): void {
    const supabase = getSupabase()
    const channel = supabase.channel(`session-updates:${userId}`)

    void channel.send({
      type: 'broadcast',
      event: SESSIONS_UPDATED_EVENT,
      payload: {},
    })
  }

  /** Unsubscribe from the session update channel. */
  unsubscribe(): void {
    if (this.channel) {
      getSupabase().removeChannel(this.channel)
      this.channel = null
    }
  }
}

const sessionUpdateChannel = new SessionUpdateChannel()

export { sessionUpdateChannel, SessionUpdateChannel }
