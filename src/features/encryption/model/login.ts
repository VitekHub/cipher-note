/**
 * Login crypto flow: derives keys from a password-derived key and unwraps
 * the master key and field keys from server data.
 *
 * This is a pure crypto function — no auth calls, no DB reads, no side effects.
 * The caller (auth-flow.ts) handles Supabase Auth login, data fetches, and
 * store writes.
 */

import { importKey, decrypt } from '@/shared/crypto/aes-gcm'
import { deriveFullKeyHierarchy, unwrapFieldKeys } from '@/shared/crypto/key-hierarchy'
import { hexDecode } from '@/shared/crypto/memory'
import type { LoginKeysInput, LoginResult } from '@/shared/types/crypto.types'

/**
 * Unwraps the master key and field keys from server-stored encrypted material
 * using a password-derived key. No side effects - pure crypto.
 */
export async function deriveLoginKeys({
  passwordKey,
  wrappedMasterKey,
  masterKeyIV,
  serverFieldKeys,
}: LoginKeysInput): Promise<LoginResult> {
  // Import passwordKey → unwrap master key (no AAD) → derive KEK
  const passwordCryptoKey = await importKey(passwordKey)
  const masterKey = await decrypt(wrappedMasterKey, passwordCryptoKey, masterKeyIV)
  const { kek } = await deriveFullKeyHierarchy(masterKey)

  // Decode hex field keys → unwrap with KEK (verifies AAD = fieldName + version)
  const wrappedFieldKeys = serverFieldKeys.map((sfk) => ({
    fieldName: sfk.fieldName,
    version: sfk.version,
    wrappedKey: hexDecode(sfk.wrappedKey),
    iv: hexDecode(sfk.keyIV),
  }))
  const fieldKeys = await unwrapFieldKeys(wrappedFieldKeys, kek)

  return { masterKey, kek, fieldKeys }
}
