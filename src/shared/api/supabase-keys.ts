import { getSupabase } from '@/shared/api/supabase-client'
import { USERNAME_PATTERN } from '@/shared/auth/username-utils'
import { AuthError, AuthErrorCode, wrapAuthError } from '@/shared/auth/auth-errors'
import { ApiError, ApiErrorCode, wrapApiError } from '@/shared/api/api-errors'
import type {
  ServerMasterKeyEnvelope,
  ServerFieldKey,
  CachedVaultEnvelope,
  SaveWrappedKeyData,
  UpdateMasterKeyEnvelopeData,
} from '@/shared/types/api.types'
import { FIELD_KEYS_TABLE } from '@/shared/types/supabase-schema'

export interface LoginSalts {
  authSalt: string
  keySalt: string
}

/**
 * Fetch auth_salt and key_salt for a username.
 * Callable before authentication (uses SECURITY DEFINER RPC).
 * Validates username format client-side to avoid wasting rate-limited RPC calls.
 */
export async function fetchLoginSalts(username: string): Promise<LoginSalts> {
  if (!USERNAME_PATTERN.test(username)) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS)
  }

  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('get_login_salts', { p_username: username })

  if (error) throw wrapAuthError(error)
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
export async function fetchMasterKeyEnvelope(userId: string): Promise<ServerMasterKeyEnvelope> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('keys')
    .select('auth_salt, key_salt, wrapped_master_key, master_key_iv')
    .eq('user_id', userId)
    .single()

  if (error) throw wrapApiError(error)
  if (!data) throw new ApiError(ApiErrorCode.NOT_FOUND)

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
export async function fetchFieldKeys(userId: string): Promise<ServerFieldKey[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from(FIELD_KEYS_TABLE)
    .select('field_name, version, wrapped_key, key_iv')
    .eq('user_id', userId)

  if (error) throw wrapApiError(error)
  if (!data || data.length === 0) {
    throw new ApiError(ApiErrorCode.NOT_FOUND)
  }

  return data.map((row) => ({
    fieldName: row.field_name,
    version: row.version,
    wrappedKey: row.wrapped_key,
    keyIV: row.key_iv,
  }))
}

/**
 * Fetch fresh master key envelope + field keys.
 */
export async function fetchFreshEnvelope(userId: string): Promise<CachedVaultEnvelope> {
  // Sequential: both calls require an active auth session;
  // parallel requests can race on session initialization
  const masterKeyEnvelope = await fetchMasterKeyEnvelope(userId)
  const fieldKeys = await fetchFieldKeys(userId)
  return { ...masterKeyEnvelope, fieldKeys }
}

/**
 * Upsert a wrapped field key for a user.
 * Uses onConflict to handle the unique (user_id, field_name, version) constraint.
 */
export async function saveWrappedKey(userId: string, data: SaveWrappedKeyData): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from(FIELD_KEYS_TABLE).upsert(
    {
      user_id: userId,
      field_name: data.fieldName,
      version: data.version,
      wrapped_key: data.wrappedKey,
      key_iv: data.keyIV,
    },
    { onConflict: 'user_id,field_name,version' },
  )

  if (error) throw wrapApiError(error)
}

/**
 * Update the user's key envelope (auth_salt, key_salt, wrapped_master_key, master_key_iv).
 * Used after a password change to store the re-wrapped master key.
 */
export async function updateMasterKeyEnvelope(userId: string, data: UpdateMasterKeyEnvelopeData): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('keys')
    .update({
      auth_salt: data.authSalt,
      key_salt: data.keySalt,
      wrapped_master_key: data.wrappedMasterKey,
      master_key_iv: data.masterKeyIV,
    })
    .eq('user_id', userId)

  if (error) throw wrapApiError(error)
}
