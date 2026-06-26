import { zeroFill } from '@/shared/crypto/core/crypto-utils'
import { createRecoveryData } from '@/shared/crypto/keys/mnemonic'
import { generateAndWrapFieldKeys } from '@/shared/crypto/keys/field-keys'
import { deriveAuthCredentials } from '@/shared/crypto/keys/split-kdf'
import { generateMasterKey, wrapMasterKeyWithPassword } from '@/shared/crypto/keys/master-key'
import { deriveKEK } from '@/shared/crypto/core/hkdf'
import { importKey } from '@/shared/crypto/core/aes-gcm'
import type { RegistrationResult } from '@/shared/types/crypto.types'

/**
 * Derive all keys needed for registration and wrap them for server storage.
 *
 * This is a pure crypto function - no auth calls, no DB writes, no side effects.
 * The caller (auth-flow.ts) needs to handle Supabase Auth signup and data upload.
 */
export async function deriveRegistrationKeys(password: string): Promise<RegistrationResult> {
  const { authHash, passwordKey, authHashSalt, passwordKeySalt } = await deriveAuthCredentials(password)
  const masterKey = generateMasterKey()

  try {
    // Derive KEK + wrap master key + create recovery data
    const [kekBytes, { wrappedMasterKey, masterKeyIV }, { mnemonic, recoveryData }] = await Promise.all([
      deriveKEK(masterKey),
      wrapMasterKeyWithPassword(masterKey, passwordKey),
      createRecoveryData(masterKey),
    ])

    const kek = await importKey(kekBytes)
    zeroFill(kekBytes)
    const { cryptoFieldKeys, wrappedFieldKeys } = await generateAndWrapFieldKeys(kek)

    return {
      authHash,
      vault: { kek, fieldKeys: cryptoFieldKeys },
      keyEnvelope: { authHashSalt, passwordKeySalt, wrappedMasterKey, masterKeyIV },
      wrappedFieldKeys,
      recovery: { ...recoveryData, mnemonic },
    }
  } finally {
    zeroFill(masterKey)
  }
}
