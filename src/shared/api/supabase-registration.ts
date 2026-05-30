import { getSupabase } from '@/shared/api/supabase-client'
import { wrapApiError } from '@/shared/api/api-errors'
import { hexEncode } from '@/shared/crypto/crypto-utils'
import type { RegistrationResult } from '@/shared/types/crypto.types'

export async function uploadRegistrationData(data: RegistrationResult, userId: string): Promise<void> {
  const supabase = getSupabase()

  // 1. Insert keys row (auth salts + wrapped master key)
  const { error: keysError } = await supabase.from('keys').insert({
    user_id: userId,
    auth_salt: hexEncode(data.authSalt),
    key_salt: hexEncode(data.keySalt),
    wrapped_master_key: hexEncode(data.wrappedMasterKey),
    master_key_iv: hexEncode(data.masterKeyIV),
  })
  if (keysError) throw wrapApiError(keysError)

  // 2. Insert field_keys rows (3 wrapped field keys, version 1)
  const fieldKeysRows = data.wrappedFieldKeys.map((fk) => ({
    user_id: userId,
    field_name: fk.fieldName,
    version: fk.version,
    wrapped_key: hexEncode(fk.wrappedKey),
    key_iv: hexEncode(fk.iv),
  }))
  const { error: fieldKeysError } = await supabase.from('field_keys').insert(fieldKeysRows)
  if (fieldKeysError) throw wrapApiError(fieldKeysError)

  // 3. Insert recovery row (mnemonic-wrapped master key)
  const { error: recoveryError } = await supabase.from('recovery').insert({
    user_id: userId,
    recovery_salt: hexEncode(data.recoveryData.recoverySalt),
    wrapped_master_key: hexEncode(data.recoveryData.wrappedMasterKey),
    recovery_iv: hexEncode(data.recoveryData.recoveryIV),
  })
  if (recoveryError) throw wrapApiError(recoveryError)
}
