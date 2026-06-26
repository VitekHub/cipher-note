import { derivePasswordKey, deriveAuthCredentials } from '@/shared/crypto/split-kdf'
import { importKey, encrypt, decrypt } from '@/shared/crypto/aes-gcm'
import { hexDecode, generateIV, generateKey, zeroFill } from '@/shared/crypto/crypto-utils'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { PasswordChangeResult } from '@/shared/types/crypto.types'
import type { ServerMasterKeyEnvelope } from '@/shared/types/api.types'

/** Generate a 256-bit random master key. Used once during registration. */
export function generateMasterKey(): Uint8Array<ArrayBuffer> {
  return generateKey()
}

/**
 * Unwrap the master key from its password-protected envelope.
 * Zeroes the password key after import; caller must zeroFill the returned master key.
 * @throws DecryptionError if the password is wrong or data is corrupted
 */
export async function unwrapMasterKeyWithPassword(
  password: string,
  envelope: ServerMasterKeyEnvelope,
): Promise<Uint8Array<ArrayBuffer>> {
  const passwordKeySalt = hexDecode(envelope.passwordKeySalt)
  const wrappedMasterKey = hexDecode(envelope.wrappedMasterKey)
  const masterKeyIV = hexDecode(envelope.masterKeyIV)

  const passwordKey = await derivePasswordKey(password, passwordKeySalt)
  const cryptoPasswordKey = await importKey(passwordKey)
  zeroFill(passwordKey)

  return decrypt(wrappedMasterKey, cryptoPasswordKey, {
    iv: masterKeyIV,
    aad: MASTER_KEY_PASSWORD_AAD,
  })
}

/**
 * Wrap the master key with a password-derived key for server storage.
 * Zeroes the raw password key after import; caller must zeroFill the master key.
 */
export async function wrapMasterKeyWithPassword(
  masterKey: Uint8Array<ArrayBuffer>,
  passwordKey: Uint8Array<ArrayBuffer>,
): Promise<{ wrappedMasterKey: Uint8Array<ArrayBuffer>; masterKeyIV: Uint8Array<ArrayBuffer> }> {
  const cryptoPasswordKey = await importKey(passwordKey)
  zeroFill(passwordKey)

  const masterKeyIV = generateIV()
  const wrappedMasterKey = await encrypt(masterKey, cryptoPasswordKey, {
    iv: masterKeyIV,
    aad: MASTER_KEY_PASSWORD_AAD,
  })

  return { wrappedMasterKey, masterKeyIV }
}

/**
 * Change the user's password by re-wrapping the master key.
 *
 * The master key itself is never changed - only its wrapping.
 * Field keys encrypted with the KEK are completely unaffected.
 *
 * @param oldPassword - The user's current password
 * @param newPassword - The desired new password
 * @param envelope - The current key envelope (hex strings from the server)
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  envelope: ServerMasterKeyEnvelope,
): Promise<PasswordChangeResult> {
  const masterKey = await unwrapMasterKeyWithPassword(oldPassword, envelope)

  // Generate new salts and derive new credentials
  const newCredentials = await deriveAuthCredentials(newPassword)

  // Re-wrap master key with new password key
  const { wrappedMasterKey: newWrappedMasterKey, masterKeyIV: newMasterKeyIV } = await wrapMasterKeyWithPassword(
    masterKey,
    newCredentials.passwordKey,
  )
  zeroFill(masterKey)

  return {
    newAuthHash: newCredentials.authHash,
    newAuthHashSalt: newCredentials.authHashSalt,
    newPasswordKeySalt: newCredentials.passwordKeySalt,
    newWrappedMasterKey,
    newMasterKeyIV,
  }
}
