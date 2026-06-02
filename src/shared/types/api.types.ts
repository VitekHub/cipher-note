import type { FieldName } from '@/shared/types/entities/field.types'

export interface ServerMasterKeyEnvelope {
  authSalt: string
  keySalt: string
  wrappedMasterKey: string
  masterKeyIV: string
}

export interface CachedVaultEnvelope extends ServerMasterKeyEnvelope {
  fieldKeys: ServerFieldKey[]
}

export interface ServerFieldKey {
  fieldName: string
  version: number
  wrappedKey: string
  keyIV: string
}

export interface ServerEncryptedField {
  fieldName: FieldName
  encryptedBlob: string
  iv: string
  updatedAt: string
}

export interface ServerRecoveryData {
  recoverySalt: string
  wrappedMasterKey: string
  recoveryIV: string
}

export interface SaveWrappedKeyData {
  fieldName: string
  version: number
  wrappedKey: string
  keyIV: string
}

export interface SaveFieldData {
  encryptedBlob: string
  iv: string
}

export interface SaveRecoveryData {
  recoverySalt: string
  wrappedMasterKey: string
  recoveryIV: string
}
