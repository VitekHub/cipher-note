import { getSupabase } from '@/shared/api/supabase-client'
import { wrapApiError } from '@/shared/api/api-errors'
import type { ServerEncryptedField, SaveFieldData } from '@/shared/types/api.types'
import type { FieldName } from '@/shared/types/entities/field.types'

/**
 * Fetch all encrypted fields for a single entry.
 * Returns an array of 0–4 fields (title, note, website, email).
 */
export async function fetchFieldsByEntry(entryId: string): Promise<ServerEncryptedField[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('encrypted_fields')
    .select('entry_id, field_name, encrypted_blob, iv, updated_at')
    .eq('entry_id', entryId)

  if (error) throw wrapApiError(error)
  return (data ?? []).map(mapServerField)
}

/**
 * Fetch a single encrypted field by entry and field name.
 * Returns null if the field has never been saved.
 */
export async function fetchFieldByEntry(entryId: string, fieldName: FieldName): Promise<ServerEncryptedField | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('encrypted_fields')
    .select('entry_id, field_name, encrypted_blob, iv, updated_at')
    .eq('entry_id', entryId)
    .eq('field_name', fieldName)
    .maybeSingle()

  if (error) throw wrapApiError(error)
  if (!data) return null
  return mapServerField(data)
}

/**
 * Upsert an encrypted field for an entry.
 * Uses onConflict to handle the unique (entry_id, field_name) constraint.
 * Requires userId for RLS (INSERT policy checks user_id = auth.uid()).
 */
export async function saveField(userId: string, data: SaveFieldData): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('encrypted_fields').upsert(
    {
      user_id: userId,
      entry_id: data.entryId,
      field_name: data.fieldName,
      encrypted_blob: data.encryptedBlob,
      iv: data.iv,
    },
    { onConflict: 'entry_id,field_name' },
  )

  if (error) throw wrapApiError(error)
}

/** Map a Supabase row (snake_case) to ServerEncryptedField (camelCase). */
function mapServerField(row: {
  entry_id: string
  field_name: string
  encrypted_blob: string
  iv: string
  updated_at: string
}): ServerEncryptedField {
  return {
    entryId: row.entry_id,
    fieldName: row.field_name as FieldName,
    encryptedBlob: row.encrypted_blob,
    iv: row.iv,
    updatedAt: row.updated_at,
  }
}
