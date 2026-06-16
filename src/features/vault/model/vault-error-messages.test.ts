import { describe, it, expect, vi } from 'vitest'

import { getVaultErrorMessage } from './vault-error-messages'
import { DecryptionError, CorruptedDataError, Argon2Error } from '@/shared/crypto/errors'

const t = vi.fn((key: string) => key) as unknown as import('i18next').TFunction<'vault'>

describe('getVaultErrorMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps DecryptionError to errors.wrongPassword', () => {
    const result = getVaultErrorMessage(new DecryptionError(), t)
    expect(result).toBe('errors.wrongPassword')
  })

  it('maps DecryptionError with cause to errors.wrongPassword', () => {
    const error = new DecryptionError(undefined, { cause: new Error('operation error') })
    const result = getVaultErrorMessage(error, t)
    expect(result).toBe('errors.wrongPassword')
  })

  it('maps CorruptedDataError to errors.corruptedData', () => {
    const result = getVaultErrorMessage(new CorruptedDataError(), t)
    expect(result).toBe('errors.corruptedData')
  })

  it('maps Argon2Error to errors.argon2Failed', () => {
    const result = getVaultErrorMessage(new Argon2Error(), t)
    expect(result).toBe('errors.argon2Failed')
  })

  it('maps network TypeError to errors.networkError', () => {
    const result = getVaultErrorMessage(new TypeError('Failed to fetch'), t)
    expect(result).toBe('common:errors.networkError')
  })

  it('maps network Error to errors.networkError', () => {
    const result = getVaultErrorMessage(new Error('A Network failure occurred'), t)
    expect(result).toBe('common:errors.networkError')
  })

  it('maps Supabase plain-object with network message to errors.networkError', () => {
    const supabaseError = { message: 'Failed to fetch', code: '', details: '', hint: '' }
    const result = getVaultErrorMessage(supabaseError, t)
    expect(result).toBe('common:errors.networkError')
  })

  it('maps unknown error to errors.unexpectedError', () => {
    const result = getVaultErrorMessage(new Error('something unexpected'), t)
    expect(result).toBe('common:errors.unexpectedError')
  })

  it('maps non-Error thrown value to errors.unexpectedError', () => {
    const result = getVaultErrorMessage('string error', t)
    expect(result).toBe('common:errors.unexpectedError')
  })
})
