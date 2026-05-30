import { getSupabase } from '@/shared/api/supabase-client'
import { wrapApiError } from '@/shared/api/api-errors'
import type { ServerRecoveryData, SaveRecoveryData } from '@/shared/types/api.types'

/**
 * Fetch recovery data for a user.
 * Returns null if the user has no recovery row.
 */
export async function fetchRecoveryData(userId: string): Promise<ServerRecoveryData | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('recovery')
    .select('recovery_salt, wrapped_master_key, recovery_iv')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw wrapApiError(error)
  if (!data) return null

  return {
    recoverySalt: data.recovery_salt,
    wrappedMasterKey: data.wrapped_master_key,
    recoveryIV: data.recovery_iv,
  }
}

/**
 * Upsert recovery data for a user.
 * Uses onConflict to handle the PK (user_id) constraint.
 */
export async function saveRecoveryData(userId: string, data: SaveRecoveryData): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('recovery').upsert(
    {
      user_id: userId,
      recovery_salt: data.recoverySalt,
      wrapped_master_key: data.wrappedMasterKey,
      recovery_iv: data.recoveryIV,
    },
    { onConflict: 'user_id' },
  )

  if (error) throw wrapApiError(error)
}
