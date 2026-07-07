import { getSupabase } from '@/shared/api/supabase-client'
import { wrapApiError } from '@/shared/api/api-errors'
import type { ServerEncryptedField, SaveFieldData } from '@/shared/types/api.types'
import type { FieldName } from '@/shared/types/entities/field.types'
import { ENCRYPTED_FIELDS_TABLE } from '@/shared/types/supabase-schema'
import type { EncryptedFieldRow } from '@/shared/types/supabase-schema'

/**
 * Fetch all encrypted fields for a single entry.
 * Returns an array of 0–4 fields (title, note, website, email).
 */
export async function fetchAllFields(entryId: string): Promise<ServerEncryptedField[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from(ENCRYPTED_FIELDS_TABLE)
    .select('entry_id, field_name, ciphertext, ciphertext_iv, updated_at')
    .eq('entry_id', entryId)

  if (error) throw wrapApiError(error)
  return (data ?? []).map(mapServerField)
}

/**
 * Fetch a single encrypted field by entry and field name.
 * Returns null if the field has never been saved.
 */
export async function fetchField(entryId: string, fieldName: FieldName): Promise<ServerEncryptedField | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from(ENCRYPTED_FIELDS_TABLE)
    .select('entry_id, field_name, ciphertext, ciphertext_iv, updated_at')
    .eq('entry_id', entryId)
    .eq('field_name', fieldName)
    .maybeSingle()

  if (error) throw wrapApiError(error)
  if (!data) return null
  return mapServerField(data)
}

/**
 * Fetch every encrypted-field row for one field across all of the user's
 * entries. RLS scopes the result to the authenticated user's own rows.
 */
export async function fetchAllEncryptedFieldsForUser(
  userId: string,
  fieldName: FieldName,
): Promise<ServerEncryptedField[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from(ENCRYPTED_FIELDS_TABLE)
    .select('entry_id, field_name, ciphertext, ciphertext_iv, updated_at')
    .eq('user_id', userId)
    .eq('field_name', fieldName)

  if (error) throw wrapApiError(error)
  return (data ?? []).map(mapServerField)
}

/**
 * Upsert an encrypted field for an entry.
 * Uses onConflict to handle the unique (entry_id, field_name) constraint.
 * Requires userId for RLS (INSERT policy checks user_id = auth.uid()).
 */
export async function saveField(userId: string, data: SaveFieldData): Promise<string> {
  const supabase = getSupabase()
  const { data: row, error } = await supabase
    .from(ENCRYPTED_FIELDS_TABLE)
    .upsert(
      {
        user_id: userId,
        entry_id: data.entryId,
        field_name: data.fieldName,
        ciphertext: data.ciphertext,
        ciphertext_iv: data.ciphertextIV,
      },
      { onConflict: 'entry_id,field_name' },
    )
    .select('updated_at')
    .single()

  if (error) throw wrapApiError(error)
  return row.updated_at
}

/** Map a Supabase row (snake_case) to ServerEncryptedField (camelCase). */
function mapServerField(row: EncryptedFieldRow): ServerEncryptedField {
  return {
    entryId: row.entry_id,
    fieldName: row.field_name as FieldName,
    ciphertext: row.ciphertext,
    ciphertextIV: row.ciphertext_iv,
    updatedAt: row.updated_at,
  }
}
