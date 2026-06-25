import { describe, it, expect } from 'vitest'
import { getRegenerateMnemonicErrorMessage } from '@/features/auth/model/regenerate-mnemonic-error-messages'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { DecryptionError } from '@/shared/crypto/errors'
import type { TFunction } from 'i18next'

const mockT = ((key: string) => key) as unknown as TFunction<'auth'>

describe('getRegenerateMnemonicErrorMessage', () => {
  it('maps DecryptionError to wrongPassword', () => {
    const message = getRegenerateMnemonicErrorMessage(new DecryptionError(), mockT)
    expect(message).toBe('regenerateMnemonic.errors.wrongPassword')
  })

  it('maps AuthError INVALID_CREDENTIALS to wrongPassword', () => {
    const message = getRegenerateMnemonicErrorMessage(new AuthError(AuthErrorCode.INVALID_CREDENTIALS), mockT)
    expect(message).toBe('regenerateMnemonic.errors.wrongPassword')
  })

  it('maps AuthError NETWORK_ERROR to networkError', () => {
    const message = getRegenerateMnemonicErrorMessage(new AuthError(AuthErrorCode.NETWORK_ERROR), mockT)
    expect(message).toBe('regenerateMnemonic.errors.networkError')
  })

  it('maps AuthError UNEXPECTED to unexpectedError', () => {
    const message = getRegenerateMnemonicErrorMessage(new AuthError(AuthErrorCode.UNEXPECTED), mockT)
    expect(message).toBe('regenerateMnemonic.errors.unexpectedError')
  })

  it('maps ApiError NETWORK_ERROR to networkError', () => {
    const message = getRegenerateMnemonicErrorMessage(new ApiError(ApiErrorCode.NETWORK_ERROR), mockT)
    expect(message).toBe('regenerateMnemonic.errors.networkError')
  })

  it('maps ApiError NOT_FOUND to notFound', () => {
    const message = getRegenerateMnemonicErrorMessage(new ApiError(ApiErrorCode.NOT_FOUND), mockT)
    expect(message).toBe('regenerateMnemonic.errors.notFound')
  })

  it('maps ApiError UNEXPECTED to unexpectedError', () => {
    const message = getRegenerateMnemonicErrorMessage(new ApiError(ApiErrorCode.UNEXPECTED), mockT)
    expect(message).toBe('regenerateMnemonic.errors.unexpectedError')
  })

  it('maps network errors to networkError', () => {
    const message = getRegenerateMnemonicErrorMessage(new TypeError('Failed to fetch'), mockT)
    expect(message).toBe('regenerateMnemonic.errors.networkError')
  })

  it('maps unknown errors to unexpectedError', () => {
    const message = getRegenerateMnemonicErrorMessage(new Error('unknown'), mockT)
    expect(message).toBe('regenerateMnemonic.errors.unexpectedError')
  })
})
