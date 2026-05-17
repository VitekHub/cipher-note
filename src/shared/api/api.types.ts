import type {
  ServerKeys,
  ServerFieldKey,
  ServerEncryptedField,
  ServerRecoveryData,
  SaveWrappedKeyData,
  SaveFieldData,
  SaveRecoveryData,
} from '@/shared/types/api.types'

export interface IApiAdapter {
  getKeys(userId: string): Promise<ServerKeys>
  getFieldKeys(userId: string): Promise<ServerFieldKey[]>
  saveWrappedKey(userId: string, data: SaveWrappedKeyData): Promise<void>

  getField(userId: string, fieldName: string): Promise<ServerEncryptedField | null>
  saveField(userId: string, fieldName: string, data: SaveFieldData): Promise<void>

  saveRecoveryData(userId: string, data: SaveRecoveryData): Promise<void>
  getRecoveryData(userId: string): Promise<ServerRecoveryData | null>
}
