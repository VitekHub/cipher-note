export const ENCRYPTED_FIELDS_TABLE = 'encrypted_fields'
export const ENTRIES_TABLE = 'entries'
export const FIELD_KEYS_TABLE = 'field_keys'
export const PUBLIC_SCHEMA = 'public'

/** Snake_case row delivered by Supabase for an `encrypted_fields` change. */
export interface EncryptedFieldRow {
  entry_id: string
  field_name: string
  encrypted_blob: string
  iv: string
  updated_at: string
}

/** Snake_case row delivered by Supabase for an `entries` change. */
export interface EntryRow {
  id: string
}

/** Snake_case row delivered by Supabase for a `field_keys` change. */
export interface FieldKeyRow {
  field_name: string
  version: number
}
