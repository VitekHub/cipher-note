/**
 * Implements Split Key Derivation Function (Split KDF):
 *   - authHash = Argon2id(password, authSalt) → hex string for Supabase Auth
 *   - passwordKey = Argon2id(password, keySalt) → Uint8Array for key wrapping
 *
 * The two salts are independent, so compromising authHash reveals nothing
 * about passwordKey, and the server (which stores authHash) cannot
 * derive passwordKey.
 */

import { deriveAuthHash, derivePasswordKey, generateSalt } from '@/shared/crypto/argon2id'
import { importKey, encrypt, decrypt, generateIV } from '@/shared/crypto/aes-gcm'
import type { AuthCredentials, LoginCredentials, PasswordChangeResult } from '@/shared/types/crypto.types'

async function deriveCredentials(
  password: string,
  authSalt: Uint8Array<ArrayBuffer>,
  keySalt: Uint8Array<ArrayBuffer>,
) {
  const [authHash, passwordKey] = await Promise.all([
    deriveAuthHash(password, authSalt),
    derivePasswordKey(password, keySalt),
  ])
  return { authHash, passwordKey }
}

/**
 * Derive authentication credentials for a new registration.
 *
 * Generates random authSalt and keySalt. The caller must persist both
 * salts on the server so they can be retrieved at login time.
 */
export async function deriveAuthCredentials(password: string): Promise<AuthCredentials> {
  const authSalt = generateSalt()
  const keySalt = generateSalt()
  const { authHash, passwordKey } = await deriveCredentials(password, authSalt, keySalt)

  return { authHash, passwordKey, authSalt, keySalt }
}

/**
 * Derive login credentials using existing salts from the server.
 */
export async function deriveLoginCredentials(
  password: string,
  authSalt: Uint8Array<ArrayBuffer>,
  keySalt: Uint8Array<ArrayBuffer>,
): Promise<LoginCredentials> {
  const { authHash, passwordKey } = await deriveCredentials(password, authSalt, keySalt)

  return { authHash, passwordKey }
}

/**
 * Change the user's password by re-wrapping the master key.
 *
 * 1. Derive old password key → unwrap master key
 * 2. Generate new salts and derive new credentials
 * 3. Re-wrap master key with new password key
 *
 * The master key itself is never changed - only its wrapping.
 * Field keys encrypted with the KEK are completely unaffected.
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  keySalt: Uint8Array<ArrayBuffer>,
  wrappedMasterKey: Uint8Array<ArrayBuffer>,
  masterKeyIV: Uint8Array<ArrayBuffer>,
): Promise<PasswordChangeResult> {
  // Derive old password key and unwrap master key
  const oldPasswordKey = await derivePasswordKey(oldPassword, keySalt)
  const oldWrappingKey = await importKey(oldPasswordKey)
  const masterKey = await decrypt(wrappedMasterKey, oldWrappingKey, masterKeyIV)

  // Generate new salts and derive new credentials
  const newAuthSalt = generateSalt()
  const newKeySalt = generateSalt()
  const { authHash: newAuthHash, passwordKey: newPasswordKey } = await deriveCredentials(
    newPassword,
    newAuthSalt,
    newKeySalt,
  )

  // Re-wrap master key with new password key
  const newWrappingKey = await importKey(newPasswordKey)
  const newIV = generateIV()
  const { ciphertext: newWrappedMasterKey, iv: newMasterKeyIV } = await encrypt(masterKey, newWrappingKey, newIV)

  return {
    newAuthHash,
    newAuthSalt,
    newKeySalt,
    newWrappedMasterKey,
    newMasterKeyIV,
  }
}
