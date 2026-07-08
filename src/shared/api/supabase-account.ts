import { getSupabase } from '@/shared/api/supabase-client'
import { wrapApiError } from '@/shared/api/api-errors'
import { DELETE_ACCOUNT_RPC } from '@/shared/types/supabase-schema'

/**
 * Delete the authenticated user's account and all associated data.
 *
 * Calls the `delete_account` SECURITY DEFINER RPC, which deletes from
 * `auth.users` — cascading through all public tables via ON DELETE CASCADE.
 * The client must verify the user's password before calling this function
 * to prevent accidental deletion from an unlocked session.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await getSupabase().rpc(DELETE_ACCOUNT_RPC)

  if (error) throw wrapApiError(error)
}
