/**
 * Split KDF: single Argon2id + HKDF-Expand.
 * Argon2id(password, kdfSalt) → masterSecret, then HKDF branches:
 *   "auth" → authHash, "password-key" → passwordKey.
 * Caller provides the salt (generated for registration, fetched from server for login).
 */

import { deriveKey } from '@/shared/crypto/core/argon2id'
import { deriveAuthHash, derivePasswordKey } from '@/shared/crypto/core/hkdf'
import { hexEncode, zeroFill } from '@/shared/crypto/core/crypto-utils'
import type { AuthCredentials } from '@/shared/types/crypto.types'

/** Derive authHash and passwordKey from a password and salt using a single Argon2id call. */
export async function deriveAuthCredentials(
  password: string,
  kdfSalt: Uint8Array<ArrayBuffer>,
): Promise<AuthCredentials> {
  const masterSecret = await deriveKey(password, kdfSalt)

  try {
    const [authHash, passwordKey] = await Promise.all([
      deriveAuthHash(masterSecret).then(hexEncode),
      derivePasswordKey(masterSecret),
    ])

    return { authHash, passwordKey, kdfSalt }
  } finally {
    zeroFill(masterSecret)
  }
}
