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
import type { LoginResult } from '@/shared/types/crypto.types'
import type { ServerFieldKey } from '@/shared/types/api.types'

/**
 * Derive login keys from a password key and server-stored wrapped key material.
 *
 * Steps:
 * 1. Import passwordKey as AES-GCM CryptoKey
 * 2. Decrypt (unwrap) master key using passwordKey + masterKeyIV (no AAD)
 * 3. Derive key hierarchy (KEK + signing key seed) from master key
 * 4. Convert server field keys from hex to binary WrappedFieldKey format
 * 5. Unwrap field keys with KEK (verifies AAD = fieldName + version)
 *
 * @param passwordKey - Raw 32-byte key derived from Argon2id (from deriveLoginCredentials)
 * @param wrappedMasterKey - Encrypted master key from server (binary)
 * @param masterKeyIV - IV used to encrypt the master key (binary)
 * @param serverFieldKeys - Wrapped field key data from server (hex strings)
 * @returns The unwrapped master key, KEK CryptoKey, and field keys Map
 */
export async function deriveLoginKeys(
  passwordKey: Uint8Array<ArrayBuffer>,
  wrappedMasterKey: Uint8Array<ArrayBuffer>,
  masterKeyIV: Uint8Array<ArrayBuffer>,
  serverFieldKeys: ServerFieldKey[],
): Promise<LoginResult> {
  // 1. Import passwordKey as AES-GCM CryptoKey for master key unwrapping
  const passwordCryptoKey = await importKey(passwordKey)

  // 2. Unwrap master key (no AAD — master key wrapping omits AAD per design)
  const masterKey = await decrypt(wrappedMasterKey, passwordCryptoKey, masterKeyIV)

  // 3. Derive key hierarchy (KEK + signing key seed) from master key
  const { kek } = await deriveFullKeyHierarchy(masterKey)

  // 4. Convert server field keys from hex to binary WrappedFieldKey format
  const wrappedFieldKeys = serverFieldKeys.map((sfk) => ({
    fieldName: sfk.fieldName,
    version: sfk.version,
    wrappedKey: hexDecode(sfk.wrappedKey),
    iv: hexDecode(sfk.keyIV),
  }))

  // 5. Unwrap field keys with KEK (verifies AAD = fieldName + version)
  const fieldKeys = await unwrapFieldKeys(wrappedFieldKeys, kek)

  return { masterKey, kek, fieldKeys }
}
