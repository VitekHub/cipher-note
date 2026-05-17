export type FieldName = 'note' | 'website' | 'email'

export interface EncryptedField {
  fieldName: FieldName
  encryptedBlob: string
  iv: string
  updatedAt: string
}

export interface DecryptedField {
  fieldName: FieldName
  content: string
  updatedAt: string
}
