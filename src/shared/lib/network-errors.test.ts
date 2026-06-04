import { describe, it, expect } from 'vitest'
import { isNetworkError } from '@/shared/lib/network-errors'

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

  it('detects plain string "Failed to fetch"', () => {
    expect(isNetworkError('Failed to fetch')).toBe(true)
  })

  it('detects plain string containing "network" (case-insensitive)', () => {
    expect(isNetworkError('A Network failure occurred')).toBe(true)
  })

  it('detects plain string "NetworkError"', () => {
    expect(isNetworkError('NetworkError')).toBe(true)
  })

  it('returns false for non-network string', () => {
    expect(isNetworkError('something else')).toBe(false)
  })

  it('returns false for non-network errors', () => {
    expect(isNetworkError(new Error('Invalid credentials'))).toBe(false)
    expect(isNetworkError(new Error('Something went wrong'))).toBe(false)
  })

  it('returns false for non-Error, non-string values', () => {
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(42)).toBe(false)
  })

  it('detects Supabase plain-object with network message', () => {
    const supabaseError = { message: 'Failed to fetch', code: '', details: '', hint: '' }
    expect(isNetworkError(supabaseError)).toBe(true)
  })

  it('returns false for Supabase plain-object with non-network message', () => {
    const supabaseError = { message: 'Invalid input', code: '22P02', details: '', hint: '' }
    expect(isNetworkError(supabaseError)).toBe(false)
  })
})
