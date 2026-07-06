/** System-wide cryptographic key length in bytes (256 bits). */
export const CRYPTO_KEY_LENGTH = 32 as const

/** System-wide cryptographic salt length in bytes (128 bits). */
export const CRYPTO_SALT_LENGTH = 16 as const

/** System-wide cryptographic iv length in bytes (96 bits). */
export const CRYPTO_IV_LENGTH = 12 as const

/** Key version for field key wrapping — increments on each rotation. */
export const FIELD_KEY_VERSION = 1 as const

/** Content/cipher scheme version for field encryption — only changes if the encryption scheme changes. */
export const FIELD_CONTENT_VERSION = 1 as const

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
  wrappedFieldKey: Uint8Array<ArrayBuffer>
  fieldKeyIV: Uint8Array<ArrayBuffer>
}

export interface EncryptedFieldData {
  ciphertext: Uint8Array<ArrayBuffer>
  ciphertextIV: Uint8Array<ArrayBuffer>
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
  kdfSalt: Uint8Array<ArrayBuffer>
}

export interface PasswordChangeResult {
  newAuthHash: string
  newKdfSalt: Uint8Array<ArrayBuffer>
  newWrappedMasterKey: Uint8Array<ArrayBuffer>
  newMasterKeyIV: Uint8Array<ArrayBuffer>
}

export interface RecoveryData {
  recoveryWrappedMasterKey: Uint8Array<ArrayBuffer>
  recoveryKeyIV: Uint8Array<ArrayBuffer>
  recoveryKeySalt: Uint8Array<ArrayBuffer>
  recoveryAuthHash: string
}

export interface RecoveryUnwrapResult {
  masterKey: Uint8Array<ArrayBuffer>
  recoveryAuthHash: string
}

export interface RegistrationResult {
  authHash: string
  vault: {
    kek: CryptoKey
    fieldKeys: Map<string, CryptoKey>
  }
  keyEnvelope: {
    kdfSalt: Uint8Array<ArrayBuffer>
    wrappedMasterKey: Uint8Array<ArrayBuffer>
    masterKeyIV: Uint8Array<ArrayBuffer>
  }
  wrappedFieldKeys: WrappedFieldKey[]
  recovery: RecoveryData & { mnemonic: string }
}
