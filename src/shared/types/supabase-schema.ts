export const LOGIN_SALTS_TABLE = 'login_salts'
export const MASTER_KEYS_TABLE = 'master_keys'
export const FIELD_KEYS_TABLE = 'field_keys'
export const ENTRIES_TABLE = 'entries'
export const ENCRYPTED_FIELDS_TABLE = 'encrypted_fields'
export const RECOVERY_KEYS_TABLE = 'recovery_keys'
export const PUBLIC_SCHEMA = 'public'

/** RPC function name for fetching login salts (pre-auth). */
export const GET_LOGIN_SALTS_RPC = 'get_login_salts'

/** RPC function name for checking username availability (pre-auth). */
export const CHECK_USERNAME_AVAILABILITY_RPC = 'check_username_availability'

/** RPC function name for fetching recovery data (pre-auth). */
export const GET_RECOVERY_DATA_RPC = 'get_recovery_data'

/** RPC function name for account recovery (pre-auth, rate-limited). */
export const RECOVER_ACCOUNT_RPC = 'recover_account'

/** RPC function name for saving recovery data (authenticated, bcrypt-hashes auth proof). */
export const SAVE_RECOVERY_DATA_RPC = 'save_recovery_data'

/** Snake_case row delivered by Supabase for an `encrypted_fields` change. */
export interface EncryptedFieldRow {
  entry_id: string
  field_name: string
  ciphertext: string
  ciphertext_iv: string
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
  wrapped_field_key: string
  field_key_iv: string
}
