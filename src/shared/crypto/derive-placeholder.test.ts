import { describe, it, expect } from 'vitest'
import { deriveCredentials } from '@/shared/crypto/derive-placeholder'

describe('deriveCredentials (placeholder)', () => {
  it('returns all four fields as 64-char hex strings', async () => {
    const result = await deriveCredentials('testuser', 'testpass')
    expect(result.authHash).toHaveLength(64)
    expect(result.passwordKey).toHaveLength(64)
    expect(result.keySalt).toHaveLength(64)
    expect(result.authSalt).toHaveLength(64)
    for (const value of Object.values(result)) {
      expect(value).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('produces deterministic output for same inputs', async () => {
    const a = await deriveCredentials('user1', 'pass1')
    const b = await deriveCredentials('user1', 'pass1')
    expect(a).toEqual(b)
  })

  it('produces different authHash for different passwords', async () => {
    const a = await deriveCredentials('user1', 'pass1')
    const b = await deriveCredentials('user1', 'pass2')
    expect(a.authHash).not.toBe(b.authHash)
  })

  it('produces different salts for different usernames', async () => {
    const a = await deriveCredentials('alice', 'pass1')
    const b = await deriveCredentials('bob', 'pass1')
    expect(a.authSalt).not.toBe(b.authSalt)
    expect(a.keySalt).not.toBe(b.keySalt)
  })
})
