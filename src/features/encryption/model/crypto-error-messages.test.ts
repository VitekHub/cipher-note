import { describe, it, expect, vi } from 'vitest'

import { getCryptoErrorMessage } from './crypto-error-messages'
import { DecryptionError, CorruptedDataError, Argon2Error } from '@/shared/crypto/errors'

const t = vi.fn((key: string) => key) as unknown as import('i18next').TFunction<'crypto'>

describe('getCryptoErrorMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps DecryptionError to errors.wrongPassword', () => {
    const result = getCryptoErrorMessage(new DecryptionError(), t)
    expect(result).toBe('errors.wrongPassword')
  })

  it('maps DecryptionError with cause to errors.wrongPassword', () => {
    const error = new DecryptionError(undefined, { cause: new Error('operation error') })
    const result = getCryptoErrorMessage(error, t)
    expect(result).toBe('errors.wrongPassword')
  })

  it('maps CorruptedDataError to errors.corruptedData', () => {
    const result = getCryptoErrorMessage(new CorruptedDataError(), t)
    expect(result).toBe('errors.corruptedData')
  })

  it('maps Argon2Error to errors.argon2Failed', () => {
    const result = getCryptoErrorMessage(new Argon2Error(), t)
    expect(result).toBe('errors.argon2Failed')
  })

  it('maps network TypeError to errors.networkError', () => {
    const result = getCryptoErrorMessage(new TypeError('Failed to fetch'), t)
    expect(result).toBe('errors.networkError')
  })

  it('maps unknown error to errors.decryptFailed', () => {
    const result = getCryptoErrorMessage(new Error('something unexpected'), t)
    expect(result).toBe('errors.decryptFailed')
  })

  it('maps non-Error thrown value to errors.decryptFailed', () => {
    const result = getCryptoErrorMessage('string error', t)
    expect(result).toBe('errors.decryptFailed')
  })
})
