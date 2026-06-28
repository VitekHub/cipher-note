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
import {
  LOGIN_SALTS_TABLE,
  MASTER_KEYS_TABLE,
  FIELD_KEYS_TABLE,
  GET_LOGIN_SALTS_RPC,
} from '@/shared/types/supabase-schema'

export interface LoginSalts {
  kdfSalt: string
}

/**
 * Fetch kdf_salt for a username.
 * Callable before authentication (uses SECURITY DEFINER RPC).
 * Validates username format client-side to avoid wasting rate-limited RPC calls.
 */
export async function fetchLoginSalts(username: string): Promise<LoginSalts> {
  if (!USERNAME_PATTERN.test(username)) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS)
  }

  const supabase = getSupabase()
  const { data, error } = await supabase.rpc(GET_LOGIN_SALTS_RPC, { p_username: username })

  if (error) throw wrapAuthError(error)
  if (!data || data.length === 0) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS)
  }

  const row = data[0]
  return { kdfSalt: row.kdf_salt }
}

/**
 * Fetch the user's key envelope (requires authenticated user).
 * Returns kdf_salt (from login_salts), wrapped master key, and IV (from master_keys).
 */
export async function fetchMasterKeyEnvelope(userId: string): Promise<ServerMasterKeyEnvelope> {
  const supabase = getSupabase()

  const [saltsResult, masterResult] = await Promise.all([
    supabase.from(LOGIN_SALTS_TABLE).select('kdf_salt').eq('user_id', userId).single(),
    supabase.from(MASTER_KEYS_TABLE).select('wrapped_master_key, master_key_iv').eq('user_id', userId).single(),
  ])

  if (saltsResult.error) throw wrapApiError(saltsResult.error)
  if (!saltsResult.data) throw new ApiError(ApiErrorCode.NOT_FOUND)
  if (masterResult.error) throw wrapApiError(masterResult.error)
  if (!masterResult.data) throw new ApiError(ApiErrorCode.NOT_FOUND)

  return {
    kdfSalt: saltsResult.data.kdf_salt,
    wrappedMasterKey: masterResult.data.wrapped_master_key,
    masterKeyIV: masterResult.data.master_key_iv,
  }
}

/**
 * Fetch the user's wrapped field keys (requires authenticated user).
 */
export async function fetchFieldKeys(userId: string): Promise<ServerFieldKey[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from(FIELD_KEYS_TABLE)
    .select('field_name, version, wrapped_field_key, field_key_iv')
    .eq('user_id', userId)

  if (error) throw wrapApiError(error)
  if (!data || data.length === 0) {
    throw new ApiError(ApiErrorCode.NOT_FOUND)
  }

  return data.map((row) => ({
    fieldName: row.field_name,
    version: row.version,
    wrappedFieldKey: row.wrapped_field_key,
    fieldKeyIV: row.field_key_iv,
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
      wrapped_field_key: data.wrappedFieldKey,
      field_key_iv: data.fieldKeyIV,
    },
    { onConflict: 'user_id,field_name,version' },
  )

  if (error) throw wrapApiError(error)
}

/**
 * Update the user's key envelope (kdf_salt, wrapped_master_key, master_key_iv).
 * Used after a password change to store the re-wrapped master key.
 */
export async function updateMasterKeyEnvelope(userId: string, data: UpdateMasterKeyEnvelopeData): Promise<void> {
  const supabase = getSupabase()

  // Update salt in login_salts
  const { error: saltsError } = await supabase
    .from(LOGIN_SALTS_TABLE)
    .update({
      kdf_salt: data.kdfSalt,
    })
    .eq('user_id', userId)

  if (saltsError) throw wrapApiError(saltsError)

  // Update master key in master_keys
  const { error: masterError } = await supabase
    .from(MASTER_KEYS_TABLE)
    .update({
      wrapped_master_key: data.wrappedMasterKey,
      master_key_iv: data.masterKeyIV,
    })
    .eq('user_id', userId)

  if (masterError) throw wrapApiError(masterError)
}
