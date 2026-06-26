/** The four encrypted fields each entry owns. */
export type FieldName = 'title' | 'note' | 'website' | 'email'

/** Canonical list of all field names — single source of truth. */
export const FIELD_NAMES = ['title', 'note', 'website', 'email'] as const

/** A field as stored on the server — ciphertext, IV, and metadata. */
export interface EncryptedField {
  entryId: string
  fieldName: FieldName
  /** Hex-encoded AES-GCM ciphertext. */
  ciphertext: string
  /** Hex-encoded initialization vector for AES-GCM. */
  ciphertextIV: string
  updatedAt: string
}

/** A field after client-side decryption — plaintext content and metadata. */
export interface DecryptedField {
  entryId: string
  fieldName: FieldName
  content: string
  updatedAt: string
}
