/**
 * HKDF-Expand (SHA-256): derives independent sub-keys from a root secret.
 * Each info string produces a cryptographically independent key.
 */

import { CRYPTO_KEY_LENGTH } from '@/shared/types/crypto.types'

/** HKDF info strings — single source of truth for all branches in the codebase. */
const HKDF_INFO = {
  KEK: 'wrap',
  SIGN: 'sign',
  AUTH: 'auth',
  PASSWORD_KEY: 'password-key',
} as const

const HKDF_ALGORITHM = { name: 'HKDF', hash: 'SHA-256' }

const encoder = new TextEncoder()

/** HKDF-Expand: derive an independent sub-key from a PRK using the given info string. */
export async function hkdfExpand(
  prk: Uint8Array<ArrayBuffer>,
  info: string,
  length: number = CRYPTO_KEY_LENGTH,
): Promise<Uint8Array<ArrayBuffer>> {
  if (prk.length !== CRYPTO_KEY_LENGTH) {
    throw new Error(`Invalid PRK length: expected ${CRYPTO_KEY_LENGTH} bytes, got ${prk.length}`)
  }

  const baseKey = await crypto.subtle.importKey('raw', prk, HKDF_ALGORITHM, false, ['deriveBits'])

  const derivedBits = await crypto.subtle.deriveBits(
    {
      ...HKDF_ALGORITHM,
      // empty salt: PRK is already a cryptographically random 256-bit value
      salt: new Uint8Array(0),
      info: encoder.encode(info),
    },
    baseKey,
    length * 8,
  )

  return new Uint8Array(derivedBits)
}

/** Derive the Key Encryption Key (KEK) from a master key. */
export async function deriveKEK(masterKey: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return hkdfExpand(masterKey, HKDF_INFO.KEK)
}

/** Derive the signing key seed from a master key. */
export async function deriveSigningKeySeed(masterKey: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return hkdfExpand(masterKey, HKDF_INFO.SIGN)
}

/** Derive the auth hash from a Split KDF master secret. */
export async function deriveAuthHash(masterSecret: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return hkdfExpand(masterSecret, HKDF_INFO.AUTH)
}

/** Derive the password key from a Split KDF master secret. */
export async function derivePasswordKey(masterSecret: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return hkdfExpand(masterSecret, HKDF_INFO.PASSWORD_KEY)
}
