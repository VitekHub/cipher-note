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
  getMasterKeyEnvelope(userId: string): Promise<ServerMasterKeyEnvelope>
  getFieldKeys(userId: string): Promise<ServerFieldKey[]>
  saveWrappedKey(userId: string, data: SaveWrappedKeyData): Promise<void>

  getField(userId: string, fieldName: string): Promise<ServerEncryptedField | null>
  saveField(userId: string, fieldName: string, data: SaveFieldData): Promise<void>

  saveRecoveryData(userId: string, data: SaveRecoveryData): Promise<void>
  getRecoveryData(userId: string): Promise<ServerRecoveryData | null>
}
