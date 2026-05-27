/**
 * Registration crypto flow: derives all keys and wraps them for server storage.
 *
 * This is a pure crypto function — no auth calls, no DB writes, no side effects.
 * The caller (auth-flow.ts) handles Supabase Auth signup and data upload.
 */

import { importKey, encrypt } from '@/shared/crypto/aes-gcm'
import { generateIV, generateSalt, zeroFill } from '@/shared/crypto/crypto-utils'
import { generateMnemonic, wrapMasterKeyWithRecovery } from '@/shared/crypto/mnemonic'
import {
  generateMasterKey,
  generateFieldKeys,
  deriveFullKeyHierarchy,
  wrapFieldKeys,
} from '@/shared/crypto/key-hierarchy'
import { deriveAuthCredentials } from '@/shared/crypto/split-kdf'
import { FIELD_KEY_VERSION, MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import type { RegistrationResult } from '@/shared/types/crypto.types'

export async function deriveRegistrationKeys(password: string): Promise<RegistrationResult> {
  // Derive auth credentials + master key + key hierarchy
  const { authHash, passwordKey, authSalt, keySalt } = await deriveAuthCredentials(password)
  const masterKey = generateMasterKey()
  const hierarchy = await deriveFullKeyHierarchy(masterKey)

  // Generate and wrap field keys (AAD = fieldName + version)
  const { rawFieldKeys, cryptoFieldKeys } = await generateFieldKeys()
  const versions = new Map(Array.from(rawFieldKeys.keys()).map((name) => [name, FIELD_KEY_VERSION] as const))
  const wrappedFieldKeys = await wrapFieldKeys(rawFieldKeys, hierarchy.kek, versions)

  // Wrap master key with password key (AAD prevents cross-context decryption)
  const passwordCryptoKey = await importKey(passwordKey)
  const masterKeyIV = generateIV()
  const wrappedMasterKey = await encrypt(masterKey, passwordCryptoKey, {
    iv: masterKeyIV,
    aad: MASTER_KEY_PASSWORD_AAD,
  })

  // Recovery: generate mnemonic and wrap master key with recovery KEK
  const mnemonic = await generateMnemonic()
  const recoveryData = await wrapMasterKeyWithRecovery(masterKey, mnemonic, { iv: generateIV(), salt: generateSalt() })
  zeroFill(masterKey)

  return {
    authHash,
    authSalt,
    keySalt,
    kek: hierarchy.kek,
    fieldKeys: cryptoFieldKeys,
    wrappedMasterKey,
    masterKeyIV,
    wrappedFieldKeys,
    recoveryData,
    mnemonic,
  }
}
