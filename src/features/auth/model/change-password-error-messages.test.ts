import { describe, it, expect } from 'vitest'
import { getChangePasswordErrorMessage } from '@/features/auth/model/change-password-error-messages'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { DecryptionError } from '@/shared/crypto/errors'
import type { TFunction } from 'i18next'

// Mock t function that returns the key — typed to satisfy TFunction<'auth'>
const mockT = ((key: string) => key) as unknown as TFunction<'auth'>

describe('getChangePasswordErrorMessage', () => {
  it('maps DecryptionError to wrongCurrentPassword', () => {
    const message = getChangePasswordErrorMessage(new DecryptionError(), mockT)
    expect(message).toBe('changePassword.errors.wrongCurrentPassword')
  })

  it('maps AuthError INVALID_CREDENTIALS to authFailed', () => {
    const message = getChangePasswordErrorMessage(new AuthError(AuthErrorCode.INVALID_CREDENTIALS), mockT)
    expect(message).toBe('changePassword.errors.authFailed')
  })

  it('maps AuthError NETWORK_ERROR to networkError', () => {
    const message = getChangePasswordErrorMessage(new AuthError(AuthErrorCode.NETWORK_ERROR), mockT)
    expect(message).toBe('changePassword.errors.networkError')
  })

  it('maps AuthError UNEXPECTED to unexpectedError', () => {
    const message = getChangePasswordErrorMessage(new AuthError(AuthErrorCode.UNEXPECTED), mockT)
    expect(message).toBe('changePassword.errors.unexpectedError')
  })

  it('maps ApiError NETWORK_ERROR to networkError', () => {
    const message = getChangePasswordErrorMessage(new ApiError(ApiErrorCode.NETWORK_ERROR), mockT)
    expect(message).toBe('changePassword.errors.networkError')
  })

  it('maps ApiError NOT_FOUND to notFound', () => {
    const message = getChangePasswordErrorMessage(new ApiError(ApiErrorCode.NOT_FOUND), mockT)
    expect(message).toBe('changePassword.errors.notFound')
  })

  it('maps ApiError UNEXPECTED to unexpectedError', () => {
    const message = getChangePasswordErrorMessage(new ApiError(ApiErrorCode.UNEXPECTED), mockT)
    expect(message).toBe('changePassword.errors.unexpectedError')
  })

  it('maps network errors to networkError', () => {
    const networkError = new TypeError('Failed to fetch')
    const message = getChangePasswordErrorMessage(networkError, mockT)
    expect(message).toBe('changePassword.errors.networkError')
  })

  it('maps unknown errors to unexpectedError', () => {
    const message = getChangePasswordErrorMessage(new Error('unknown'), mockT)
    expect(message).toBe('changePassword.errors.unexpectedError')
  })
})
