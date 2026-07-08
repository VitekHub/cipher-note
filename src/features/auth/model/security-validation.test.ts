import { describe, it, expect } from 'vitest'
import { registerSchema } from '@/features/auth/model/register-schema'
import { loginSchema } from '@/features/auth/model/login-schema'
import { USERNAME_PATTERN } from '@/shared/auth/username-utils'
import { PASSWORD_MIN_LENGTH } from '@/shared/auth/password-utils'

// Field content (title, note, website, email) is intentionally NOT input-validated:
// it is encrypted client-side and stored as ciphertext, so the server never sees
// plaintext and the DB cannot be queried for it. XSS in field values is mitigated
// by React's text-only rendering — there is no `dangerouslySetInnerHTML` anywhere
// in src/ (verified by grep in the verification step). These tests cover the
// unencrypted auth inputs (username, password) where validation is security-critical:
// the username is mapped to a Supabase Auth email and used in pre-auth RPCs, so
// rejecting malformed/malicious input at the schema layer prevents injecting
// control characters, SQL-like fragments, or markup into those flows.

describe('security — input validation rejects malicious input', () => {
  describe('USERNAME_PATTERN', () => {
    const maliciousUsernames = [
      "' OR 1=1--",
      'admin";--',
      '<script>alert(1)</script>',
      'user name', // space
      'user@name', // special char
      'user/name',
      'user;drop',
      'user.name',
      'user-name',
      'a'.repeat(33), // overlength
      'ab', // underlength
      '',
    ]

    for (const username of maliciousUsernames) {
      it(`rejects ${JSON.stringify(username)}`, () => {
        expect(USERNAME_PATTERN.test(username)).toBe(false)
      })
    }

    const validUsernames = ['abc', 'user_123', 'ABC_def', 'a'.repeat(32)]
    for (const username of validUsernames) {
      it(`accepts ${JSON.stringify(username)}`, () => {
        expect(USERNAME_PATTERN.test(username)).toBe(true)
      })
    }
  })

  describe('registerSchema username', () => {
    const validPasswords = { password: 'validPassword1', confirmPassword: 'validPassword1' }

    it('rejects SQL-injection-style username', async () => {
      const result = await registerSchema.safeParseAsync({ username: "' OR 1=1--", ...validPasswords })
      expect(result.success).toBe(false)
    })

    it('rejects XSS payload in username', async () => {
      const result = await registerSchema.safeParseAsync({
        username: '<script>alert(1)</script>',
        ...validPasswords,
      })
      expect(result.success).toBe(false)
    })

    it('rejects overlength username (>32)', async () => {
      const result = await registerSchema.safeParseAsync({ username: 'a'.repeat(33), ...validPasswords })
      expect(result.success).toBe(false)
    })

    it('rejects underlength username (<3)', async () => {
      const result = await registerSchema.safeParseAsync({ username: 'ab', ...validPasswords })
      expect(result.success).toBe(false)
    })

    it('rejects username with spaces', async () => {
      const result = await registerSchema.safeParseAsync({ username: 'user name', ...validPasswords })
      expect(result.success).toBe(false)
    })
  })

  describe('registerSchema password', () => {
    it(`rejects password shorter than ${PASSWORD_MIN_LENGTH} characters`, async () => {
      const result = await registerSchema.safeParseAsync({
        username: 'validuser',
        password: 'short',
        confirmPassword: 'short',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('loginSchema username', () => {
    it('rejects SQL-injection-style username at login', async () => {
      const result = await loginSchema.safeParseAsync({ username: "' OR 1=1--", password: 'anything' })
      expect(result.success).toBe(false)
    })

    it('rejects XSS payload in username at login', async () => {
      const result = await loginSchema.safeParseAsync({ username: '<script>alert(1)</script>', password: 'anything' })
      expect(result.success).toBe(false)
    })
  })
})
