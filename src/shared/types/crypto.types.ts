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
