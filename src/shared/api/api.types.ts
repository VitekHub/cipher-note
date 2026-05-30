import type {
  ServerMasterKeyEnvelope,
  ServerFieldKey,
  ServerEncryptedField,
  ServerRecoveryData,
  SaveWrappedKeyData,
  SaveFieldData,
  SaveRecoveryData,
} from '@/shared/types/api.types'

export interface IApiAdapter {
  fetchMasterKeyEnvelope(userId: string): Promise<ServerMasterKeyEnvelope>
  fetchFieldKeys(userId: string): Promise<ServerFieldKey[]>
  saveWrappedKey(userId: string, data: SaveWrappedKeyData): Promise<void>

  fetchField(userId: string, fieldName: string): Promise<ServerEncryptedField | null>
  saveField(userId: string, fieldName: string, data: SaveFieldData): Promise<void>

  saveRecoveryData(userId: string, data: SaveRecoveryData): Promise<void>
  fetchRecoveryData(userId: string): Promise<ServerRecoveryData | null>
}
