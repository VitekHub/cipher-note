import { derivePasswordKey } from '@/shared/crypto/argon2id'
import { importKey, encrypt, decrypt } from '@/shared/crypto/aes-gcm'
import { hexDecode, generateIV, generateKey, zeroFill } from '@/shared/crypto/crypto-utils'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
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
  const keySalt = hexDecode(envelope.keySalt)
  const wrappedMasterKey = hexDecode(envelope.wrappedMasterKey)
  const masterKeyIV = hexDecode(envelope.masterKeyIV)

  const passwordKey = await derivePasswordKey(password, keySalt)
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
