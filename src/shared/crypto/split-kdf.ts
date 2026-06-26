/**
 * Implements Split Key Derivation Function (Split KDF):
 *   - authHash = Argon2id(password, authHashSalt) → hex string for Supabase Auth
 *   - passwordKey = Argon2id(password, passwordKeySalt) → Uint8Array for key wrapping
 *
 * The two salts are independent, so compromising authHash reveals nothing
 * about passwordKey, and the server (which stores authHash) cannot
 * derive passwordKey.
 */

import { deriveAuthHash, derivePasswordKey } from '@/shared/crypto/argon2id'
import { generateSalt, zeroFill } from '@/shared/crypto/crypto-utils'
import { unwrapMasterKeyWithPassword, wrapMasterKeyWithPassword } from '@/shared/crypto/master-key'
import type { AuthCredentials, PasswordChangeResult } from '@/shared/types/crypto.types'
import type { ServerMasterKeyEnvelope } from '@/shared/types/api.types'

/**
 * Derive authentication credentials for a new registration.
 *
 * Generates random authHashSalt and passwordKeySalt. The caller must persist both
 * salts on the server so they can be retrieved at login time.
 */
export async function deriveAuthCredentials(password: string): Promise<AuthCredentials> {
  const authHashSalt = generateSalt()
  const passwordKeySalt = generateSalt()
  const [authHash, passwordKey] = await Promise.all([
    deriveAuthHash(password, authHashSalt),
    derivePasswordKey(password, passwordKeySalt),
  ])

  return { authHash, passwordKey, authHashSalt, passwordKeySalt }
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
