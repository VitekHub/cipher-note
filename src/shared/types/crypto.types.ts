/** System-wide cryptographic key length in bytes (256 bits). */
export const CRYPTO_KEY_LENGTH = 32 as const

/** System-wide cryptographic salt length in bytes (128 bits). */
export const CRYPTO_SALT_LENGTH = 16 as const

export const FIELD_KEY_VERSION = 1 as const

export interface WrappedKey {
  wrappedKey: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
}

export interface WrappedFieldKey extends WrappedKey {
  fieldName: string
  version: number
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
  masterKey: Uint8Array<ArrayBuffer>
  kek: Uint8Array<ArrayBuffer>
  fieldKeys: Map<string, Uint8Array<ArrayBuffer>>
  wrappedMasterKey: Uint8Array<ArrayBuffer>
  masterKeyIV: Uint8Array<ArrayBuffer>
  wrappedFieldKeys: WrappedFieldKey[]
  recoveryData: RecoveryData
  mnemonic: string
}

export interface LoginResult {
  masterKey: Uint8Array<ArrayBuffer>
  kek: CryptoKey
  fieldKeys: Map<string, Uint8Array<ArrayBuffer>>
}
