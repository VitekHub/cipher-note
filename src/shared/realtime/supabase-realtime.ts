import { getSupabase } from '@/shared/api/supabase-client'
import type { IRealtimeAdapter, RealtimeCallbacks, RealtimeEntryEventType } from '@/shared/realtime/realtime.types'
import type { ServerEncryptedField } from '@/shared/types/api.types'
import type { FieldName } from '@/shared/types/entities/field.types'

// Inferred from the singleton client so we don't depend on a specific realtime type export.
type RealtimeChannel = ReturnType<ReturnType<typeof getSupabase>['channel']>

/** Snake_case row delivered by Supabase Realtime for an `encrypted_fields` change. */
interface EncryptedFieldRow {
  entry_id: string
  field_name: string
  encrypted_blob: string
  iv: string
  updated_at: string
}

/** Snake_case row delivered by Supabase Realtime for an `entries` change. */
interface EntryRow {
  id: string
}

/** Snake_case row delivered by Supabase Realtime for a `field_keys` change. */
interface FieldKeyRow {
  field_name: string
  version: number
}

const ENCRYPTED_FIELDS = 'encrypted_fields'
const ENTRIES = 'entries'
const FIELD_KEYS = 'field_keys'
const PUBLIC_SCHEMA = 'public'

/**
 * Supabase Realtime adapter for client-side sync.
 *
 * Subscribes to `postgres_changes` for the current user's `encrypted_fields`,
 * `entries`, and `field_keys` rows. Realtime respects RLS, so a subscriber
 * only receives rows it can SELECT (user_id = auth.uid()) — no per-channel
 * filter is needed. The adapter is transport-only: it maps rows to the
 * RealtimeCallbacks contract and forwards errors; all cache/crypto handling
 * lives in the feature layer (`realtime-sync.ts`).
 */
class SupabaseRealtimeAdapter implements IRealtimeAdapter {
  private channel: RealtimeChannel | null = null

  subscribe(userId: string, callbacks: RealtimeCallbacks): Promise<void> {
    // Defensive: tear down any prior subscription before opening a new one.
    this.unsubscribe()

    const supabase = getSupabase()

    this.channel = supabase
      .channel(`realtime:user:${userId}`)
      .on('postgres_changes', { event: '*', schema: PUBLIC_SCHEMA, table: ENCRYPTED_FIELDS }, (payload) => {
        // Field rows are only ever cascade-deleted with their parent
        // entry, never removed directly.
        if (payload.eventType === 'DELETE') return
        const row = payload.new as EncryptedFieldRow
        const data: ServerEncryptedField = {
          entryId: row.entry_id,
          fieldName: row.field_name as FieldName,
          encryptedBlob: row.encrypted_blob,
          iv: row.iv,
          updatedAt: row.updated_at,
        }
        callbacks.onFieldChange(data.fieldName, data)
      })
      .on('postgres_changes', { event: '*', schema: PUBLIC_SCHEMA, table: ENTRIES }, (payload) => {
        // Both INSERT (new) and DELETE (old) carry the id — that's why we
        // subscribe to all events and merge new/old here.
        const eventType = payload.eventType as RealtimeEntryEventType
        const row = (payload.new ?? payload.old) as EntryRow | null
        if (!row) return
        callbacks.onEntryChange({ eventType, entryId: row.id })
      })
      .on('postgres_changes', { event: '*', schema: PUBLIC_SCHEMA, table: FIELD_KEYS }, (payload) => {
        // Field keys are versioned and rotation replaces the existing
        // row (UPDATE), never deleting one
        if (payload.eventType === 'DELETE') return
        const row = payload.new as FieldKeyRow
        callbacks.onKeyRotation(row.field_name, row.version)
      })
      .subscribe((status, error) => {
        // Realtime is best-effort: surface errors but never reject the promise or block the UI.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          callbacks.onError(error ?? new Error(`Realtime channel ${status.toLowerCase()}`))
        }
      })

    // Subscription is initiated synchronously; the connection is established
    // asynchronously via the subscribe callback above.
    return Promise.resolve()
  }

  unsubscribe(): void {
    if (this.channel) {
      getSupabase().removeChannel(this.channel)
      this.channel = null
    }
  }
}

const realtimeAdapter = new SupabaseRealtimeAdapter()

export { realtimeAdapter, SupabaseRealtimeAdapter }
