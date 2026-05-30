import { describe, it, expect } from 'vitest'
import { AuthError, AuthErrorCode, isAuthError, wrapAuthError } from '@/shared/auth/auth-errors'

describe('AuthError', () => {
  it('sets name to AuthError', () => {
    const error = new AuthError(AuthErrorCode.INVALID_CREDENTIALS)
    expect(error.name).toBe('AuthError')
  })

  it('sets message to AuthError:CODE', () => {
    const error = new AuthError(AuthErrorCode.USERNAME_TAKEN)
    expect(error.message).toBe('AuthError: USERNAME_TAKEN')
  })

  it('stores the code', () => {
    const error = new AuthError(AuthErrorCode.NETWORK_ERROR)
    expect(error.code).toBe(AuthErrorCode.NETWORK_ERROR)
  })

  it('preserves cause', () => {
    const cause = new Error('original')
    const error = new AuthError(AuthErrorCode.UNEXPECTED, { cause })
    expect(error.cause).toBe(cause)
  })

  it('is an instance of Error', () => {
    const error = new AuthError(AuthErrorCode.INVALID_CREDENTIALS)
    expect(error).toBeInstanceOf(Error)
  })
})

describe('isAuthError', () => {
  it('returns true for AuthError', () => {
    expect(isAuthError(new AuthError(AuthErrorCode.INVALID_CREDENTIALS))).toBe(true)
  })

  it('returns false for plain Error', () => {
    expect(isAuthError(new Error('test'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isAuthError(null)).toBe(false)
  })

  it('returns false for string', () => {
    expect(isAuthError('error')).toBe(false)
  })
})

describe('wrapAuthError', () => {
  it('maps network errors to NETWORK_ERROR', () => {
    const error = wrapAuthError(new TypeError('Failed to fetch'))
    expect(error).toBeInstanceOf(AuthError)
    expect(error.code).toBe(AuthErrorCode.NETWORK_ERROR)
  })

  it('maps non-network errors to UNEXPECTED', () => {
    const original = new Error('something else')
    const error = wrapAuthError(original)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.code).toBe(AuthErrorCode.UNEXPECTED)
    expect(error.cause).toBe(original)
  })

  it('preserves cause for network errors', () => {
    const original = new TypeError('Failed to fetch')
    const error = wrapAuthError(original)
    expect(error.cause).toBe(original)
  })

  it('maps non-Error values to UNEXPECTED without cause', () => {
    const error = wrapAuthError('string error')
    expect(error).toBeInstanceOf(AuthError)
    expect(error.code).toBe(AuthErrorCode.UNEXPECTED)
    expect(error.cause).toBeUndefined()
  })
})
