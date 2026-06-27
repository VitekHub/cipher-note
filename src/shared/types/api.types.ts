import type { FieldName } from '@/shared/types/entities/field.types'

export interface ServerMasterKeyEnvelope {
  authHashSalt: string
  passwordKeySalt: string
  wrappedMasterKey: string
  masterKeyIV: string
}

export interface CachedVaultEnvelope extends ServerMasterKeyEnvelope {
  fieldKeys: ServerFieldKey[]
}

export interface ServerFieldKey {
  fieldName: string
  version: number
  wrappedFieldKey: string
  fieldKeyIV: string
}

export interface ServerEncryptedField {
  entryId: string
  fieldName: FieldName
  ciphertext: string
  ciphertextIV: string
  updatedAt: string
}

export interface ServerRecoveryData {
  recoveryKeySalt: string
  recoveryWrappedMasterKey: string
  recoveryKeyIV: string
}

export interface SaveWrappedKeyData {
  fieldName: string
  version: number
  wrappedFieldKey: string
  fieldKeyIV: string
}

export interface SaveFieldData {
  entryId: string
  fieldName: FieldName
  ciphertext: string
  ciphertextIV: string
}

export interface SaveRecoveryData {
  recoveryKeySalt: string
  recoveryWrappedMasterKey: string
  recoveryKeyIV: string
}

export interface UpdateMasterKeyEnvelopeData {
  authHashSalt: string
  passwordKeySalt: string
  wrappedMasterKey: string
  masterKeyIV: string
}
