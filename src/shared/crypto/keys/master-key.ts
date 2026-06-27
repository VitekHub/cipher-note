import { derivePasswordKey, deriveAuthCredentials } from '@/shared/crypto/keys/split-kdf'
import { importKey, encrypt, decrypt } from '@/shared/crypto/core/aes-gcm'
import { hexDecode, generateIV, generateKey, generateSalt, zeroFill } from '@/shared/crypto/core/crypto-utils'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { PasswordChangeResult } from '@/shared/types/crypto.types'
import type { ServerMasterKeyEnvelope } from '@/shared/types/api.types'

/** Generate a 256-bit random master key. Used once during registration. */
export function generateMasterKey(): Uint8Array<ArrayBuffer> {
  return generateKey()
}

/**
 * Unwrap the master key from its password-protected envelope.
 * Caller must zeroFill the passwordKey after use and zeroFill the returned master key.
 * @throws DecryptionError if the passwordKey is wrong or data is corrupted
 */
export async function unwrapMasterKeyWithPassword(
  passwordKey: Uint8Array<ArrayBuffer>,
  envelope: ServerMasterKeyEnvelope,
): Promise<Uint8Array<ArrayBuffer>> {
  const wrappedMasterKey = hexDecode(envelope.wrappedMasterKey)
  const masterKeyIV = hexDecode(envelope.masterKeyIV)

  const cryptoPasswordKey = await importKey(passwordKey)

  return decrypt(wrappedMasterKey, cryptoPasswordKey, {
    iv: masterKeyIV,
    aad: MASTER_KEY_PASSWORD_AAD,
  })
}

/**
 * Wrap the master key with a password-derived key for server storage.
 * Caller must zeroFill both the passwordKey and the master key after use.
 */
export async function wrapMasterKeyWithPassword(
  masterKey: Uint8Array<ArrayBuffer>,
  passwordKey: Uint8Array<ArrayBuffer>,
): Promise<{ wrappedMasterKey: Uint8Array<ArrayBuffer>; masterKeyIV: Uint8Array<ArrayBuffer> }> {
  const cryptoPasswordKey = await importKey(passwordKey)

  const masterKeyIV = generateIV()
  const wrappedMasterKey = await encrypt(masterKey, cryptoPasswordKey, {
    iv: masterKeyIV,
    aad: MASTER_KEY_PASSWORD_AAD,
  })

  return { wrappedMasterKey, masterKeyIV }
}

/**
 * Re-wrap the master key with a new password.
 *
 * The master key itself is never changed - only its wrapping.
 * Field keys encrypted with the KEK are completely unaffected.
 *
 * @param oldPassword - The user's current password
 * @param newPassword - The desired new password
 * @param envelope - The current key envelope (hex strings from the server)
 */
export async function rewrapMasterKey(
  oldPassword: string,
  newPassword: string,
  envelope: ServerMasterKeyEnvelope,
): Promise<PasswordChangeResult> {
  const oldPasswordKey = await derivePasswordKey(oldPassword, envelope.kdfSalt)
  try {
    const masterKey = await unwrapMasterKeyWithPassword(oldPasswordKey, envelope)

    // Generate new salt and derive new credentials
    const newKdfSalt = generateSalt()
    const newCredentials = await deriveAuthCredentials(newPassword, newKdfSalt)

    // Re-wrap master key with new password key
    const { wrappedMasterKey: newWrappedMasterKey, masterKeyIV: newMasterKeyIV } = await wrapMasterKeyWithPassword(
      masterKey,
      newCredentials.passwordKey,
    )
    zeroFill(masterKey)
    zeroFill(newCredentials.passwordKey)

    return {
      newAuthHash: newCredentials.authHash,
      newKdfSalt,
      newWrappedMasterKey,
      newMasterKeyIV,
    }
  } finally {
    zeroFill(oldPasswordKey)
  }
}
