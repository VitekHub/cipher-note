/**
 * Registration crypto flow: derives all keys and wraps them for server storage.
 *
 * This is a pure crypto function — no auth calls, no DB writes, no side effects.
 * The caller (auth-credentials.ts) handles Supabase Auth signup and data upload.
 */

import { importKey, encrypt, exportKey } from '@/shared/crypto/aes-gcm'
import { generateMnemonic, wrapMasterKeyWithRecovery } from '@/shared/crypto/mnemonic'
import {
  generateMasterKey,
  generateFieldKeys,
  deriveFullKeyHierarchy,
  wrapFieldKeys,
} from '@/shared/crypto/key-hierarchy'
import { deriveAuthCredentials } from '@/shared/crypto/split-kdf'
import { FIELD_KEY_VERSION } from '@/shared/types/crypto.types'
import type { RegistrationResult } from '@/shared/types/crypto.types'

export async function deriveRegistrationKeys(password: string): Promise<RegistrationResult> {
  // Derive auth credentials + master key + key hierarchy
  const { authHash, passwordKey, authSalt, keySalt } = await deriveAuthCredentials(password)
  const masterKey = generateMasterKey()
  const hierarchy = await deriveFullKeyHierarchy(masterKey)

  // Generate and wrap field keys (AAD = fieldName + version)
  const fieldKeys = generateFieldKeys()
  const versions = new Map(Array.from(fieldKeys.keys()).map((name) => [name, FIELD_KEY_VERSION] as const))
  const wrappedFieldKeys = await wrapFieldKeys(fieldKeys, hierarchy.kek, versions)

  // Wrap master key with password key (no AAD)
  const passwordCryptoKey = await importKey(passwordKey)
  const { ciphertext: wrappedMasterKey, iv: masterKeyIV } = await encrypt(masterKey, passwordCryptoKey)

  // Recovery: generate mnemonic and wrap master key with recovery KEK
  const mnemonic = await generateMnemonic()
  const recoveryData = await wrapMasterKeyWithRecovery(masterKey, mnemonic)

  const kek = await exportKey(hierarchy.kek)

  return {
    authHash,
    authSalt,
    keySalt,
    masterKey,
    kek,
    fieldKeys,
    wrappedMasterKey,
    masterKeyIV,
    wrappedFieldKeys,
    recoveryData,
    mnemonic,
  }
}
