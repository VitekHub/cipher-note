import { getSupabase } from '@/shared/api/supabase-client'
import { USERNAME_PATTERN } from '@/shared/auth/username-utils'
import { AuthError, AuthErrorCode, isNetworkError } from '@/shared/auth/auth-errors'
import type { ServerKeys, ServerFieldKey } from '@/shared/types/api.types'

export interface LoginSalts {
  authSalt: string
  keySalt: string
}

/**
 * Fetch auth_salt and key_salt for a username.
 * Callable before authentication (uses SECURITY DEFINER RPC).
 * Validates username format client-side to avoid wasting rate-limited RPC calls.
 */
export async function getLoginSalts(username: string): Promise<LoginSalts> {
  if (!USERNAME_PATTERN.test(username)) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS)
  }

  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('get_login_salts', { p_username: username })

  if (error) throw wrapApiError(error)
  if (!data || data.length === 0) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS)
  }

  const row = data[0]
  return { authSalt: row.auth_salt, keySalt: row.key_salt }
}

/**
 * Fetch the user's key material (requires authenticated user).
 * Returns salts, wrapped master key, and IV.
 */
export async function getKeys(userId: string): Promise<ServerKeys> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('keys')
    .select('auth_salt, key_salt, wrapped_master_key, master_key_iv')
    .eq('user_id', userId)
    .single()

  if (error) throw wrapApiError(error)
  if (!data) throw new AuthError(AuthErrorCode.KEYS_NOT_FOUND)

  return {
    authSalt: data.auth_salt,
    keySalt: data.key_salt,
    wrappedMasterKey: data.wrapped_master_key,
    masterKeyIV: data.master_key_iv,
  }
}

/**
 * Fetch the user's wrapped field keys (requires authenticated user).
 */
export async function getFieldKeys(userId: string): Promise<ServerFieldKey[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('field_keys')
    .select('field_name, version, wrapped_key, key_iv')
    .eq('user_id', userId)

  if (error) throw wrapApiError(error)
  if (!data) {
    throw new AuthError(AuthErrorCode.KEYS_NOT_FOUND)
  }

  return data.map((row) => ({
    fieldName: row.field_name,
    version: row.version,
    wrappedKey: row.wrapped_key,
    keyIV: row.key_iv,
  }))
}

function wrapApiError(error: unknown): AuthError {
  if (isNetworkError(error)) {
    return new AuthError(AuthErrorCode.NETWORK_ERROR, { cause: error instanceof Error ? error : undefined })
  }
  return new AuthError(AuthErrorCode.UNEXPECTED, { cause: error instanceof Error ? error : undefined })
}
