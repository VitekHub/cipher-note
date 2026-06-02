/** The three encrypted fields each user owns. */
export type FieldName = 'note' | 'website' | 'email'

/** Canonical list of all field names — single source of truth. */
export const FIELD_NAMES: readonly FieldName[] = ['note', 'website', 'email'] as const

/** A field as stored on the server — ciphertext, IV, and metadata. */
export interface EncryptedField {
  fieldName: FieldName
  /** Hex-encoded AES-GCM ciphertext. */
  encryptedBlob: string
  /** Hex-encoded initialization vector for AES-GCM. */
  iv: string
  updatedAt: string
}

/** A field after client-side decryption — plaintext content and metadata. */
export interface DecryptedField {
  fieldName: FieldName
  content: string
  updatedAt: string
}
