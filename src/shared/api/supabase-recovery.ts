import { getSupabase } from '@/shared/api/supabase-client'
import { ApiError, ApiErrorCode, wrapApiError } from '@/shared/api/api-errors'
import {
  RECOVERY_KEYS_TABLE,
  GET_RECOVERY_DATA_RPC,
  RECOVER_ACCOUNT_RPC,
  SAVE_RECOVERY_DATA_RPC,
} from '@/shared/types/supabase-schema'
import type { ServerRecoveryData, SaveRecoveryData, RecoverAccountData } from '@/shared/types/api.types'

/**
 * Fetch recovery data for a user.
 * Returns null if the user has no recovery row.
 */
export async function fetchRecoveryData(userId: string): Promise<ServerRecoveryData | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from(RECOVERY_KEYS_TABLE)
    .select('recovery_key_salt, recovery_wrapped_master_key, recovery_key_iv')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw wrapApiError(error)
  if (!data) return null

  return {
    recoveryKeySalt: data.recovery_key_salt,
    recoveryWrappedMasterKey: data.recovery_wrapped_master_key,
    recoveryKeyIV: data.recovery_key_iv,
  }
}

/**
 * Upsert recovery data for a user.
 * Uses a SECURITY DEFINER RPC that bcrypt-hashes recoveryAuthHash
 * before storage, ensuring the raw HKDF-derived value never appears in the DB.
 */
export async function saveRecoveryData(userId: string, data: SaveRecoveryData): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.rpc(SAVE_RECOVERY_DATA_RPC, {
    p_user_id: userId,
    p_recovery_key_salt: data.recoveryKeySalt,
    p_recovery_wrapped_master_key: data.recoveryWrappedMasterKey,
    p_recovery_key_iv: data.recoveryKeyIV,
    p_recovery_auth_hash: data.recoveryAuthHash,
  })

  if (error) throw wrapApiError(error)
}

/**
 * Fetch recovery data for a username (pre-auth, rate-limited).
 * Returns the same fields as ServerRecoveryData.
 * Throws ApiError(NOT_FOUND) if user has no recovery data.
 */
export async function fetchRecoveryDataPreAuth(username: string): Promise<ServerRecoveryData> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc(GET_RECOVERY_DATA_RPC, {
    p_username: username,
  })

  if (error) {
    // The RPC raises an exception for invalid username format or not found
    if (error.code === 'P0001' || error.message.includes('not found')) {
      throw new ApiError(ApiErrorCode.NOT_FOUND, { cause: wrapApiError(error) })
    }
    throw wrapApiError(error)
  }

  if (!data || data.length === 0) {
    throw new ApiError(ApiErrorCode.NOT_FOUND)
  }

  const row = data[0]
  return {
    recoveryKeySalt: row.recovery_key_salt,
    recoveryWrappedMasterKey: row.recovery_wrapped_master_key,
    recoveryKeyIV: row.recovery_key_iv,
  }
}

/**
 * Recover an account atomically: verify recovery proof and update
 * auth password, login_salts, and master_keys in a single RPC.
 * Returns the user ID on success.
 */
export async function recoverAccount(username: string, data: RecoverAccountData): Promise<string> {
  const supabase = getSupabase()
  const { data: userId, error } = await supabase.rpc(RECOVER_ACCOUNT_RPC, {
    p_username: username,
    p_recovery_auth_hash: data.recoveryAuthHash,
    p_new_auth_hash: data.newAuthHash,
    p_new_kdf_salt: data.newKdfSalt,
    p_new_wrapped_master_key: data.newWrappedMasterKey,
    p_new_master_key_iv: data.newMasterKeyIV,
  })

  if (error) {
    throw wrapApiError(error)
  }

  return userId
}
