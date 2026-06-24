/**
 * Implements Split Key Derivation Function (Split KDF):
 *   - authHash = Argon2id(password, authSalt) → hex string for Supabase Auth
 *   - passwordKey = Argon2id(password, keySalt) → Uint8Array for key wrapping
 *
 * The two salts are independent, so compromising authHash reveals nothing
 * about passwordKey, and the server (which stores authHash) cannot
 * derive passwordKey.
 */

import { deriveAuthHash, derivePasswordKey } from '@/shared/crypto/argon2id'
import { importKey, encrypt, decrypt } from '@/shared/crypto/aes-gcm'
import { generateSalt, generateIV, hexDecode, zeroFill } from '@/shared/crypto/crypto-utils'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { AuthCredentials, PasswordChangeResult } from '@/shared/types/crypto.types'
import type { ServerMasterKeyEnvelope } from '@/shared/types/api.types'

/**
 * Derive authentication credentials for a new registration.
 *
 * Generates random authSalt and keySalt. The caller must persist both
 * salts on the server so they can be retrieved at login time.
 */
export async function deriveAuthCredentials(password: string): Promise<AuthCredentials> {
  const authSalt = generateSalt()
  const keySalt = generateSalt()
  const [authHash, passwordKey] = await Promise.all([
    deriveAuthHash(password, authSalt),
    derivePasswordKey(password, keySalt),
  ])

  return { authHash, passwordKey, authSalt, keySalt }
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
  const keySalt = hexDecode(envelope.keySalt)
  const wrappedMasterKey = hexDecode(envelope.wrappedMasterKey)
  const masterKeyIV = hexDecode(envelope.masterKeyIV)

  // Derive old password key and unwrap master key
  const oldPasswordKey = await derivePasswordKey(oldPassword, keySalt)
  const oldWrappingKey = await importKey(oldPasswordKey)
  zeroFill(oldPasswordKey)
  const masterKey = await decrypt(wrappedMasterKey, oldWrappingKey, { iv: masterKeyIV, aad: MASTER_KEY_PASSWORD_AAD })

  // Generate new salts and derive new credentials
  const newCredentials = await deriveAuthCredentials(newPassword)

  // Re-wrap master key with new password key
  const newWrappingKey = await importKey(newCredentials.passwordKey)
  zeroFill(newCredentials.passwordKey)
  const newMasterKeyIV = generateIV()
  const newWrappedMasterKey = await encrypt(masterKey, newWrappingKey, {
    iv: newMasterKeyIV,
    aad: MASTER_KEY_PASSWORD_AAD,
  })
  zeroFill(masterKey)

  return {
    newAuthHash: newCredentials.authHash,
    newAuthSalt: newCredentials.authSalt,
    newKeySalt: newCredentials.keySalt,
    newWrappedMasterKey,
    newMasterKeyIV,
  }
}
