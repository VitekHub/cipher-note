import { describe, it, expect } from 'vitest'
import { AuthError, AuthErrorCode, isAuthError, isNetworkError } from '@/shared/auth/auth-errors'

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

describe('isNetworkError', () => {
  it('detects TypeError with "Failed to fetch" message', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('detects Error with "Failed to fetch" message', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
  })

  it('detects Error with "NetworkError" message', () => {
    expect(isNetworkError(new Error('NetworkError'))).toBe(true)
  })

  it('detects Error with "network" (case-insensitive)', () => {
    expect(isNetworkError(new Error('A Network failure occurred'))).toBe(true)
  })

  it('detects Error with "failed to fetch" in message (case-insensitive)', () => {
    expect(isNetworkError(new Error('Request failed to fetch data'))).toBe(true)
  })

  it('returns false for non-network errors', () => {
    expect(isNetworkError(new Error('Invalid credentials'))).toBe(false)
    expect(isNetworkError(new Error('Something went wrong'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError('string')).toBe(false)
    expect(isNetworkError(42)).toBe(false)
  })
})
