import { describe, it, expect } from 'vitest'
import { getCurrentSessionId } from '@/shared/auth/session-utils'

describe('getCurrentSessionId', () => {
  function makeToken(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const encodedPayload = btoa(JSON.stringify(payload))
    const signature = 'sig'
    return `${header}.${encodedPayload}.${signature}`
  }

  it('extracts session_id from a valid JWT', () => {
    const token = makeToken({ sub: 'user-123', session_id: 'abc-def-ghi' })
    expect(getCurrentSessionId(token)).toBe('abc-def-ghi')
  })

  it('returns null when session_id is missing from the payload', () => {
    const token = makeToken({ sub: 'user-123' })
    expect(getCurrentSessionId(token)).toBeNull()
  })

  it('returns null for an invalid token format', () => {
    expect(getCurrentSessionId('not-a-jwt')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(getCurrentSessionId('')).toBeNull()
  })

  it('handles URL-safe base64 encoding in the payload', () => {
    // Simulate a payload with URL-safe base64 chars (- and _)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '')
    const payload = btoa(JSON.stringify({ session_id: 'test-123' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
    const token = `${header}.${payload}.sig`
    expect(getCurrentSessionId(token)).toBe('test-123')
  })
})
