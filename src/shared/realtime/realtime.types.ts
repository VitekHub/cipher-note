import type { ServerEncryptedField } from '@/shared/types/api.types'
import type { FieldName } from '@/shared/types/entities/field.types'

/** The kind of row change a realtime `entries` event represents. */
export type RealtimeEntryEventType = 'INSERT' | 'UPDATE' | 'DELETE'

/** Payload for an `entries` realtime event. Entries carry no encrypted data —
 *  only metadata — so we just surface the event type and id (to invalidate the
 *  entry list query). */
export interface RealtimeEntryChange {
  eventType: RealtimeEntryEventType
  entryId: string
}

export interface RealtimeCallbacks {
  onFieldChange: (data: ServerEncryptedField) => void
  onEntryChange: (change: RealtimeEntryChange) => void
  onKeyRotation: (fieldName: FieldName, newVersion: number) => void
  onError: (error: Error) => void
}

export interface IRealtimeAdapter {
  subscribe(userId: string, callbacks: RealtimeCallbacks): Promise<void>
  unsubscribe(): void
}
