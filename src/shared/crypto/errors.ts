export class CryptoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CryptoError'
  }
}

export class DecryptionError extends CryptoError {
  constructor(message = 'crypto:errors.decryptFailed', options?: ErrorOptions) {
    super(message, options)
    this.name = 'DecryptionError'
  }
}

export class CorruptedDataError extends CryptoError {
  constructor(message = 'crypto:errors.corruptedData', options?: ErrorOptions) {
    super(message, options)
    this.name = 'CorruptedDataError'
  }
}

export class Argon2Error extends CryptoError {
  constructor(message = 'crypto:errors.argon2Failed', options?: ErrorOptions) {
    super(message, options)
    this.name = 'Argon2Error'
  }
}
