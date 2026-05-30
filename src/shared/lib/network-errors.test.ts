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
