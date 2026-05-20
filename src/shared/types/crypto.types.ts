export interface WrappedKey {
  wrappedKey: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
}

export interface WrappedFieldKey extends WrappedKey {
  fieldName: string
  version: number
}

export interface EncryptedFieldData {
  ciphertext: Uint8Array
  iv: Uint8Array
}

export interface KeyHierarchy {
  masterKey: Uint8Array
  kek: CryptoKey
  signingKeySeed: Uint8Array
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
  passwordKey: Uint8Array
  authSalt: Uint8Array
  keySalt: Uint8Array
}

export interface LoginCredentials {
  authHash: string
  passwordKey: Uint8Array
}

export interface PasswordChangeResult {
  newAuthHash: string
  newAuthSalt: Uint8Array
  newKeySalt: Uint8Array
  newWrappedMasterKey: Uint8Array
  newMasterKeyIV: Uint8Array
}

export interface RecoveryData {
  wrappedMasterKey: Uint8Array
  recoveryIV: Uint8Array
  recoverySalt: Uint8Array
}
