import { deriveKey } from '@/shared/crypto/core/argon2id'
import { importKey, encrypt, decrypt } from '@/shared/crypto/core/aes-gcm'
import { generateIV, generateSalt, hexEncode, zeroFill } from '@/shared/crypto/core/crypto-utils'
import { hkdfExpand, HKDF_INFO } from '@/shared/crypto/core/hkdf'
import { CRYPTO_KEY_LENGTH, MASTER_KEY_RECOVERY_AAD } from '@/shared/types/crypto.types'
import { MnemonicError } from '@/shared/crypto/core/errors'
import type { RecoveryData, RecoveryUnwrapResult, RecoveryWrapOptions } from '@/shared/types/crypto.types'

// --- Lazy-load @scure/bip39 ---

interface Bip39Module {
  generateMnemonic: (wordlist: string[], strength?: number) => string
  validateMnemonic: (mnemonic: string, wordlist: string[]) => boolean
  mnemonicToSeedSync: (mnemonic: string, passphrase?: string) => Uint8Array
  wordlist: string[]
}

let bip39Promise: Promise<Bip39Module> | null = null

function loadBip39(): Promise<Bip39Module> {
  if (!bip39Promise) {
    bip39Promise = Promise.all([import('@scure/bip39'), import('@scure/bip39/wordlists/english.js')]).then(
      ([bip39, english]) => ({
        generateMnemonic: bip39.generateMnemonic,
        validateMnemonic: bip39.validateMnemonic,
        mnemonicToSeedSync: bip39.mnemonicToSeedSync,
        wordlist: english.wordlist,
      }),
    )
  }
  return bip39Promise
}

let cachedWordlistSet: Set<string> | null = null

/**
 * Get the BIP-39 English wordlist as a Set for O(1) word validation.
 * Lazy-loads @scure/bip39 on first call, sharing the same cache as other functions.
 */
export async function getBip39Wordlist(): Promise<Set<string>> {
  if (cachedWordlistSet) return cachedWordlistSet
  const { wordlist } = await loadBip39()
  cachedWordlistSet = new Set(wordlist)
  return cachedWordlistSet
}

/** BIP-39 entropy strength for 12-word mnemonics. */
const MNEMONIC_STRENGTH = 128

/**
 * Generate a 12-word BIP-39 mnemonic from 128-bit entropy.
 * Lazy-loads @scure/bip39 on first call.
 */
export async function generateMnemonic(): Promise<string> {
  const { generateMnemonic: bip39Generate, wordlist } = await loadBip39()
  return bip39Generate(wordlist, MNEMONIC_STRENGTH)
}

/**
 * Validate a BIP-39 mnemonic (checksum + word list).
 * Lazy-loads @scure/bip39 on first call.
 */
export async function validateMnemonic(mnemonic: string): Promise<boolean> {
  const { validateMnemonic: bip39Validate, wordlist } = await loadBip39()
  return bip39Validate(mnemonic, wordlist)
}

/**
 * Convert a BIP-39 mnemonic to a 256-bit (32-byte) seed.
 * Uses PBKDF2-SHA512 internally and truncates the 64-byte output to 32 bytes.
 *
 * NOTE: This function is a utility. The recovery KEK derivation path
 * (deriveRecoveryKEK) uses Argon2id directly with the mnemonic string,
 * NOT the BIP-39 seed.
 */
export async function mnemonicToSeed(mnemonic: string): Promise<Uint8Array<ArrayBuffer>> {
  const { mnemonicToSeedSync, validateMnemonic: bip39Validate, wordlist } = await loadBip39()
  if (!bip39Validate(mnemonic, wordlist)) throw new MnemonicError()
  const fullSeed = mnemonicToSeedSync(mnemonic)
  return fullSeed.slice(0, CRYPTO_KEY_LENGTH) as Uint8Array<ArrayBuffer>
}

/**
 * Derive a recovery Key Encryption Key (KEK) from a mnemonic using Argon2id.
 *
 * The mnemonic string is passed directly as the Argon2id "password" parameter,
 * not the BIP-39 binary seed. The human-readable phrase is the input because
 * it is what the user supplies and remembers, while the binary seed is an
 * internal derivation artifact.
 */
export async function deriveRecoveryKEK(
  mnemonic: string,
  recoverySalt: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  return deriveKey(mnemonic, recoverySalt)
}

/**
 * Wrap a master key with a recovery KEK derived from a BIP-39 mnemonic.
 * Also derives a recoveryAuthHash (HKDF of the recovery KEK) which is stored
 * on the server as a bcrypt hash for proof-of-knowledge during account recovery.
 */
export async function wrapMasterKeyWithRecovery(
  masterKey: Uint8Array<ArrayBuffer>,
  mnemonic: string,
  { iv, salt }: RecoveryWrapOptions,
): Promise<RecoveryData> {
  const recoveryKEK = await deriveRecoveryKEK(mnemonic, salt)

  try {
    const cryptoKey = await importKey(recoveryKEK)
    const recoveryWrappedMasterKey = await encrypt(masterKey, cryptoKey, {
      iv,
      aad: MASTER_KEY_RECOVERY_AAD,
    })
    const recoveryAuthHash = hexEncode(await hkdfExpand(recoveryKEK, HKDF_INFO.RECOVERY_AUTH))

    return {
      recoveryWrappedMasterKey,
      recoveryKeyIV: iv,
      recoveryKeySalt: salt,
      recoveryAuthHash,
    }
  } finally {
    zeroFill(recoveryKEK)
  }
}

/**
 * Unwrap a master key using a BIP-39 mnemonic, also deriving the recoveryAuthHash.
 *
 * @throws DecryptionError if mnemonic does not match the one used to wrap
 */
export async function unwrapMasterKeyWithRecovery(
  wrappedMasterKey: Uint8Array<ArrayBuffer>,
  mnemonic: string,
  { iv, salt }: RecoveryWrapOptions,
): Promise<RecoveryUnwrapResult> {
  const recoveryKEK = await deriveRecoveryKEK(mnemonic, salt)
  try {
    const cryptoKey = await importKey(recoveryKEK)
    const masterKey = await decrypt(wrappedMasterKey, cryptoKey, { iv, aad: MASTER_KEY_RECOVERY_AAD })
    const recoveryAuthHash = hexEncode(await hkdfExpand(recoveryKEK, HKDF_INFO.RECOVERY_AUTH))
    return { masterKey, recoveryAuthHash }
  } finally {
    zeroFill(recoveryKEK)
  }
}

/**
 * Create fresh recovery data for a master key: generate a new BIP-39 mnemonic
 * and wrap the master key with a recovery KEK derived from it.
 *
 * @returns The new mnemonic (to show the user) and the RecoveryData
 *          (to save on the server).
 */
export async function createRecoveryData(
  masterKey: Uint8Array<ArrayBuffer>,
): Promise<{ mnemonic: string; recoveryData: RecoveryData }> {
  const mnemonic = await generateMnemonic()
  const recoveryKeyIV = generateIV()
  const recoveryKeySalt = generateSalt()
  const recoveryData = await wrapMasterKeyWithRecovery(masterKey, mnemonic, {
    iv: recoveryKeyIV,
    salt: recoveryKeySalt,
  })
  return { mnemonic, recoveryData }
}
