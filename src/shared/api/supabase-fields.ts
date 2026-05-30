import { getSupabase } from '@/shared/api/supabase-client'
import { wrapApiError } from '@/shared/api/api-errors'
import type { ServerEncryptedField, SaveFieldData } from '@/shared/types/api.types'

/**
 * Fetch a single encrypted field for a user.
 * Returns null if the field does not exist.
 */
export async function fetchField(userId: string, fieldName: string): Promise<ServerEncryptedField | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('encrypted_fields')
    .select('field_name, encrypted_blob, iv, updated_at')
    .eq('user_id', userId)
    .eq('field_name', fieldName)
    .maybeSingle()

  if (error) throw wrapApiError(error)
  if (!data) return null

  return {
    fieldName: data.field_name,
    encryptedBlob: data.encrypted_blob,
    iv: data.iv,
    updatedAt: data.updated_at,
  }
}

/**
 * Upsert an encrypted field for a user.
 * Uses onConflict to handle the unique (user_id, field_name) constraint.
 */
export async function saveField(userId: string, fieldName: string, data: SaveFieldData): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('encrypted_fields').upsert(
    {
      user_id: userId,
      field_name: fieldName,
      encrypted_blob: data.encryptedBlob,
      iv: data.iv,
    },
    { onConflict: 'user_id,field_name' },
  )

  if (error) throw wrapApiError(error)
}
