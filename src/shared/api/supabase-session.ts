import { getSupabase } from '@/shared/api/supabase-client'
import { wrapApiError } from '@/shared/api/api-errors'
import {
  GET_ACTIVE_SESSIONS_RPC,
  REVOKE_SESSION_RPC,
  REVOKE_OTHER_SESSIONS_RPC,
  IS_SESSION_VALID_RPC,
} from '@/shared/types/supabase-schema'
import type { ActiveSession } from '@/shared/types/entities/user.types'

/**
 * Fetch all active sessions for the current user.
 * Calls the get_active_sessions SECURITY DEFINER RPC.
 */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const { data, error } = await getSupabase().rpc(GET_ACTIVE_SESSIONS_RPC)

  if (error) throw wrapApiError(error)
  return (data ?? []) as ActiveSession[]
}

/**
 * Revoke a specific session by ID.
 * The RPC prevents revoking the current session (raises an exception).
 * @returns true if the session was found and deleted, false otherwise
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc(REVOKE_SESSION_RPC, {
    p_session_id: sessionId,
  })

  if (error) throw wrapApiError(error)
  return data as boolean
}

/**
 * Revoke all sessions except the current one.
 * The current session is identified by the session_id claim in the JWT.
 * @returns the number of sessions revoked
 */
export async function revokeOtherSessions(): Promise<number> {
  const { data, error } = await getSupabase().rpc(REVOKE_OTHER_SESSIONS_RPC)

  if (error) throw wrapApiError(error)
  return data as number
}

/**
 * Check whether the current session is still valid.
 * Returns FALSE if the session has been revoked (deleted from auth.sessions)
 * or the user is not authenticated. Used to detect cross-device revocation.
 */
export async function isSessionValid(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc(IS_SESSION_VALID_RPC)

  if (error) throw wrapApiError(error)
  return data as boolean
}
