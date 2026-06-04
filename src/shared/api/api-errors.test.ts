import { describe, it, expect } from 'vitest'
import { ApiError, ApiErrorCode, isApiError, wrapApiError } from '@/shared/api/api-errors'

describe('ApiError', () => {
  it('constructs with code and default message', () => {
    const error = new ApiError(ApiErrorCode.NOT_FOUND)
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.name).toBe('ApiError')
    expect(error.message).toBe('ApiError: NOT_FOUND')
    expect(error.code).toBe('NOT_FOUND')
  })

  it('preserves cause via ErrorOptions', () => {
    const cause = new Error('db down')
    const error = new ApiError(ApiErrorCode.UNEXPECTED, { cause })
    expect(error.cause).toBe(cause)
  })
})

describe('isApiError', () => {
  it('returns true for ApiError instances', () => {
    expect(isApiError(new ApiError(ApiErrorCode.NETWORK_ERROR))).toBe(true)
  })

  it('returns false for plain Error', () => {
    expect(isApiError(new Error('oops'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isApiError(null)).toBe(false)
  })

  it('returns false for string', () => {
    expect(isApiError('ApiError: NOT_FOUND')).toBe(false)
  })
})

describe('wrapApiError', () => {
  it('maps TypeError "Failed to fetch" to NETWORK_ERROR', () => {
    const error = wrapApiError(new TypeError('Failed to fetch'))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe(ApiErrorCode.NETWORK_ERROR)
  })

  it('maps Error with "network" in message to NETWORK_ERROR', () => {
    const error = wrapApiError(new Error('A Network failure occurred'))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe(ApiErrorCode.NETWORK_ERROR)
  })

  it('maps plain-object Supabase PostgrestError with network message to NETWORK_ERROR', () => {
    // Supabase returns plain objects, not Error instances, at runtime
    // https://github.com/supabase/supabase-js/pull/2240
    const supabaseError = { message: 'Failed to fetch', code: '', details: '', hint: '' }
    const error = wrapApiError(supabaseError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe(ApiErrorCode.NETWORK_ERROR)
  })

  it('maps plain-object error with non-network message to UNEXPECTED', () => {
    const supabaseError = { message: 'Invalid input', code: '22P02', details: '', hint: '' }
    const error = wrapApiError(supabaseError)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe(ApiErrorCode.UNEXPECTED)
  })

  it('maps non-network errors to UNEXPECTED', () => {
    const original = new Error('something else')
    const error = wrapApiError(original)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe(ApiErrorCode.UNEXPECTED)
    expect(error.cause).toBe(original)
  })

  it('maps non-Error values to UNEXPECTED', () => {
    const error = wrapApiError('string error')
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe(ApiErrorCode.UNEXPECTED)
    expect(error.cause).toBeUndefined()
  })
})
