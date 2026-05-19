import { describe, it, expect } from 'vitest'
import { isSafeRedirect } from '@/features/auth/ui/url-utils'

describe('isSafeRedirect', () => {
  it('allows relative paths', () => {
    expect(isSafeRedirect('/dashboard')).toBe(true)
    expect(isSafeRedirect('/settings/profile')).toBe(true)
  })

  it('rejects undefined', () => {
    expect(isSafeRedirect(undefined)).toBe(false)
  })

  it('rejects external URLs', () => {
    expect(isSafeRedirect('https://evil.com')).toBe(false)
    expect(isSafeRedirect('http://example.com')).toBe(false)
  })

  it('rejects protocol-relative URLs', () => {
    expect(isSafeRedirect('//evil.com')).toBe(false)
  })

  it('rejects paths without leading slash', () => {
    expect(isSafeRedirect('dashboard')).toBe(false)
  })
})
