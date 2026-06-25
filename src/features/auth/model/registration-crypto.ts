import { zeroFill } from '@/shared/crypto/crypto-utils'
import { createRecoveryData } from '@/shared/crypto/mnemonic'
import {
  generateMasterKey,
  generateFieldKeys,
  deriveFullKeyHierarchy,
  wrapFieldKeys,
} from '@/shared/crypto/key-hierarchy'
import { deriveAuthCredentials } from '@/shared/crypto/split-kdf'
import { wrapMasterKeyWithPassword } from '@/shared/crypto/master-key'
import { FIELD_KEY_VERSION } from '@/shared/types/crypto.types'
import type { RegistrationResult } from '@/shared/types/crypto.types'

/**
 * Derive all keys needed for registration and wrap them for server storage.
 *
 * This is a pure crypto function - no auth calls, no DB writes, no side effects.
 * The caller (auth-flow.ts) needs to handle Supabase Auth signup and data upload.
 */
export async function deriveRegistrationKeys(password: string): Promise<RegistrationResult> {
  // Derive auth credentials + master key + key hierarchy
  const { authHash, passwordKey, authSalt, keySalt } = await deriveAuthCredentials(password)
  const masterKey = generateMasterKey()

  try {
    const hierarchy = await deriveFullKeyHierarchy(masterKey)

    // Generate and wrap field keys (AAD = fieldName + version)
    const { rawFieldKeys, cryptoFieldKeys } = await generateFieldKeys()
    const versions = new Map(Array.from(rawFieldKeys.keys()).map((name) => [name, FIELD_KEY_VERSION] as const))
    const wrappedFieldKeys = await wrapFieldKeys(rawFieldKeys, hierarchy.kek, versions)
    zeroFill(rawFieldKeys.values())

    // Wrap master key with password key (AAD prevents cross-context decryption)
    const { wrappedMasterKey, masterKeyIV } = await wrapMasterKeyWithPassword(masterKey, passwordKey)

    // Recovery: generate mnemonic and wrap master key with recovery KEK
    const { mnemonic, recoveryData } = await createRecoveryData(masterKey)

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
  } finally {
    zeroFill(masterKey)
  }
}
