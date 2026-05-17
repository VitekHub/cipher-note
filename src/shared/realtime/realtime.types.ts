import type { ServerEncryptedField } from '@/shared/types/api.types'

export interface RealtimeCallbacks {
  onFieldChange: (fieldName: string, data: ServerEncryptedField) => void
  onKeyRotation: (fieldName: string, newVersion: number) => void
  onError: (error: Error) => void
}

export interface IRealtimeAdapter {
  subscribe(userId: string, callbacks: RealtimeCallbacks): Promise<void>
  unsubscribe(): void
}
