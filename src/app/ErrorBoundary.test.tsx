import { describe, it, expect } from 'vitest'
import { CryptoError, DecryptionError, CorruptedDataError } from '@/shared/crypto/errors'

describe('CryptoError classes', () => {
  it('CryptoError has correct name', () => {
    const error = new CryptoError('test error')
    expect(error.name).toBe('CryptoError')
    expect(error.message).toBe('test error')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(CryptoError)
  })

  it('DecryptionError extends CryptoError', () => {
    const error = new DecryptionError()
    expect(error.name).toBe('DecryptionError')
    expect(error.message).toBe('vault:errors.decryptFailed')
    expect(error).toBeInstanceOf(CryptoError)
    expect(error).toBeInstanceOf(Error)
  })

  it('DecryptionError accepts custom message', () => {
    const error = new DecryptionError('custom message')
    expect(error.message).toBe('custom message')
  })

  it('CorruptedDataError extends CryptoError', () => {
    const error = new CorruptedDataError()
    expect(error.name).toBe('CorruptedDataError')
    expect(error.message).toBe('vault:errors.corruptedData')
    expect(error).toBeInstanceOf(CryptoError)
    expect(error).toBeInstanceOf(Error)
  })

  it('CorruptedDataError accepts custom message', () => {
    const error = new CorruptedDataError('custom message')
    expect(error.message).toBe('custom message')
  })
})
