import type { ServerFieldKey } from '@/shared/types/api.types'

/** System-wide cryptographic key length in bytes (256 bits). */
export const CRYPTO_KEY_LENGTH = 32 as const

/** System-wide cryptographic salt length in bytes (128 bits). */
export const CRYPTO_SALT_LENGTH = 16 as const

/** System-wide cryptographic iv length in bytes (96 bits). */
export const CRYPTO_IV_LENGTH = 12 as const

/** System-wide cryptographic field key version number. */
export const FIELD_KEY_VERSION = 1 as const

/** AAD context strings for master key wrapping — prevent cross-context decryption. */
export const MASTER_KEY_PASSWORD_AAD = new TextEncoder().encode('master-key-password')
export const MASTER_KEY_RECOVERY_AAD = new TextEncoder().encode('master-key-recovery')

export interface AesGcmOptions {
  iv: Uint8Array<ArrayBuffer>
  aad: Uint8Array<ArrayBuffer>
}

export interface RecoveryWrapOptions {
  iv: Uint8Array<ArrayBuffer>
  salt: Uint8Array<ArrayBuffer>
}

export interface WrappedFieldKey {
  fieldName: string
  version: number
  wrappedKey: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
}

export interface EncryptedFieldData {
  ciphertext: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
}

export interface KeyHierarchy {
  masterKey: Uint8Array<ArrayBuffer>
  kek: CryptoKey
  signingKeySeed: Uint8Array<ArrayBuffer>
}

export interface Argon2Params {
  memory: number
  iterations: number
  parallelism: number
  outputLen: number
}

export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  memory: 47104,
  iterations: 3,
  parallelism: 1,
  outputLen: 32,
}

export interface AuthCredentials {
  authHash: string
  passwordKey: Uint8Array<ArrayBuffer>
  authSalt: Uint8Array<ArrayBuffer>
  keySalt: Uint8Array<ArrayBuffer>
}

export interface LoginCredentials {
  authHash: string
  passwordKey: Uint8Array<ArrayBuffer>
}

export interface PasswordChangeResult {
  newAuthHash: string
  newAuthSalt: Uint8Array<ArrayBuffer>
  newKeySalt: Uint8Array<ArrayBuffer>
  newWrappedMasterKey: Uint8Array<ArrayBuffer>
  newMasterKeyIV: Uint8Array<ArrayBuffer>
}

export interface RecoveryData {
  wrappedMasterKey: Uint8Array<ArrayBuffer>
  recoveryIV: Uint8Array<ArrayBuffer>
  recoverySalt: Uint8Array<ArrayBuffer>
}

export interface RegistrationResult {
  authHash: string
  authSalt: Uint8Array<ArrayBuffer>
  keySalt: Uint8Array<ArrayBuffer>
  kek: CryptoKey
  fieldKeys: Map<string, CryptoKey>
  wrappedMasterKey: Uint8Array<ArrayBuffer>
  masterKeyIV: Uint8Array<ArrayBuffer>
  wrappedFieldKeys: WrappedFieldKey[]
  recoveryData: RecoveryData
  mnemonic: string
}

export interface LoginKeysInput {
  /** Raw 32-byte key derived from Argon2id (from deriveLoginCredentials) */
  passwordKey: Uint8Array<ArrayBuffer>
  /** Encrypted master key from server (binary) */
  wrappedMasterKey: Uint8Array<ArrayBuffer>
  /** IV used to encrypt the master key (binary) */
  masterKeyIV: Uint8Array<ArrayBuffer>
  /** Wrapped field key data from server (hex strings) */
  serverFieldKeys: ServerFieldKey[]
}

export interface LoginResult {
  masterKey: Uint8Array<ArrayBuffer>
  kek: CryptoKey
  fieldKeys: Map<string, Uint8Array<ArrayBuffer>>
}
