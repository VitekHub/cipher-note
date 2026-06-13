import { getSupabase } from '@/shared/api/supabase-client'
import { wrapApiError } from '@/shared/api/api-errors'
import type { ServerEntry } from '@/shared/types/api.types'

/** Fetch all entries for a user, ordered by creation time. */
export async function fetchEntries(userId: string): Promise<ServerEntry[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('entries')
    .select('id, user_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw wrapApiError(error)
  return data ?? []
}

/** Create a new entry. */
export async function createEntry(userId: string): Promise<ServerEntry> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: userId })
    .select('id, user_id, created_at, updated_at')
    .single()

  if (error) throw wrapApiError(error)
  return data
}

/** Delete an entry. ON DELETE CASCADE removes associated encrypted_fields. */
export async function deleteEntry(entryId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('entries').delete().eq('id', entryId)

  if (error) throw wrapApiError(error)
}
