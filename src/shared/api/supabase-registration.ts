import { getSupabase } from '@/shared/api/supabase-client'
import { wrapApiError } from '@/shared/api/api-errors'
import { hexEncode } from '@/shared/crypto/crypto-utils'
import type { RegistrationResult } from '@/shared/types/crypto.types'
import {
  LOGIN_SALTS_TABLE,
  MASTER_KEYS_TABLE,
  ENTRIES_TABLE,
  FIELD_KEYS_TABLE,
  RECOVERY_KEYS_TABLE,
} from '@/shared/types/supabase-schema'

export async function uploadRegistrationData(data: RegistrationResult, userId: string): Promise<void> {
  const supabase = getSupabase()

  // 1. Insert login salts
  const { error: saltsError } = await supabase.from(LOGIN_SALTS_TABLE).insert({
    user_id: userId,
    auth_hash_salt: hexEncode(data.keyEnvelope.authHashSalt),
    password_key_salt: hexEncode(data.keyEnvelope.passwordKeySalt),
  })
  if (saltsError) throw wrapApiError(saltsError)

  // 2. Insert wrapped master key
  const { error: masterKeysError } = await supabase.from(MASTER_KEYS_TABLE).insert({
    user_id: userId,
    wrapped_master_key: hexEncode(data.keyEnvelope.wrappedMasterKey),
    master_key_iv: hexEncode(data.keyEnvelope.masterKeyIV),
  })
  if (masterKeysError) throw wrapApiError(masterKeysError)

  // 3. Insert entries row (user's first entry)
  const { error: entriesError } = await supabase.from(ENTRIES_TABLE).insert({
    user_id: userId,
  })
  if (entriesError) throw wrapApiError(entriesError)

  // 4. Insert field_keys rows (4 wrapped field keys, version 1)
  const fieldKeysRows = data.wrappedFieldKeys.map((fk) => ({
    user_id: userId,
    field_name: fk.fieldName,
    version: fk.version,
    wrapped_field_key: hexEncode(fk.wrappedFieldKey),
    field_key_iv: hexEncode(fk.fieldKeyIV),
  }))
  const { error: fieldKeysError } = await supabase.from(FIELD_KEYS_TABLE).insert(fieldKeysRows)
  if (fieldKeysError) throw wrapApiError(fieldKeysError)

  // 5. Insert recovery row (mnemonic-wrapped master key)
  const { error: recoveryError } = await supabase.from(RECOVERY_KEYS_TABLE).insert({
    user_id: userId,
    recovery_key_salt: hexEncode(data.recovery.recoveryKeySalt),
    recovery_wrapped_master_key: hexEncode(data.recovery.recoveryWrappedMasterKey),
    recovery_key_iv: hexEncode(data.recovery.recoveryKeyIV),
  })
  if (recoveryError) throw wrapApiError(recoveryError)
}
