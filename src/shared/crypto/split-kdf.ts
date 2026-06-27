/**
 * Implements Split Key Derivation Function (Split KDF):
 *   - authHash = Argon2id(password, authHashSalt) → hex string for Supabase Auth
 *   - passwordKey = Argon2id(password, passwordKeySalt) → Uint8Array for key wrapping
 *
 * The two salts are independent, so compromising authHash reveals nothing
 * about passwordKey, and the server (which stores authHash) cannot
 * derive passwordKey.
 */

import { deriveKey } from '@/shared/crypto/argon2id'
import { generateSalt, hexEncode } from '@/shared/crypto/crypto-utils'
import type { AuthCredentials } from '@/shared/types/crypto.types'

/**
 * Derive an auth hash for Supabase Auth verification.
 * Returns a 64-character hex string suitable for use as a "password" in Supabase Auth.
 */
export async function deriveAuthHash(password: string, authSalt: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = await deriveKey(password, authSalt)
  return hexEncode(hash)
}

/**
 * Derive a password key for wrapping the master key.
 * Returns a 32-byte Uint8Array for use in AES-256-GCM key wrapping.
 */
export async function derivePasswordKey(
  password: string,
  keySalt: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  return deriveKey(password, keySalt)
}

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
