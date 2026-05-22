import { describe, it, expect } from 'vitest'
import { toSupabaseEmail, fromSupabaseEmail, isCiphernoteInternalEmail, USERNAME_PATTERN } from './username-utils'

describe('USERNAME_PATTERN', () => {
  it('accepts lowercase letters', () => {
    expect(USERNAME_PATTERN.test('alice')).toBe(true)
  })

  it('accepts uppercase letters', () => {
    expect(USERNAME_PATTERN.test('Alice')).toBe(true)
    expect(USERNAME_PATTERN.test('TESTUSER')).toBe(true)
  })

  it('accepts digits and underscores', () => {
    expect(USERNAME_PATTERN.test('user_123')).toBe(true)
  })

  it('accepts mixed case', () => {
    expect(USERNAME_PATTERN.test('TestUser')).toBe(true)
  })

  it('rejects special characters', () => {
    expect(USERNAME_PATTERN.test('user@name')).toBe(false)
    expect(USERNAME_PATTERN.test('user name')).toBe(false)
    expect(USERNAME_PATTERN.test('user!')).toBe(false)
  })

  it('rejects too-short usernames', () => {
    expect(USERNAME_PATTERN.test('ab')).toBe(false)
  })

  it('rejects too-long usernames', () => {
    expect(USERNAME_PATTERN.test('a'.repeat(33))).toBe(false)
  })

  it('accepts exactly 3 characters', () => {
    expect(USERNAME_PATTERN.test('abc')).toBe(true)
  })

  it('accepts exactly 32 characters', () => {
    expect(USERNAME_PATTERN.test('a'.repeat(32))).toBe(true)
  })
})

describe('username-utils', () => {
  describe('toSupabaseEmail', () => {
    it('maps username to ciphernote.internal email', () => {
      expect(toSupabaseEmail('alice')).toBe('alice@ciphernote.internal')
    })

    it('lowercases the username before appending domain', () => {
      expect(toSupabaseEmail('Alice')).toBe('alice@ciphernote.internal')
      expect(toSupabaseEmail('TestUser')).toBe('testuser@ciphernote.internal')
    })

    it('handles usernames with underscores and numbers', () => {
      expect(toSupabaseEmail('user_123')).toBe('user_123@ciphernote.internal')
    })

    it('handles minimum length username (3 chars)', () => {
      expect(toSupabaseEmail('abc')).toBe('abc@ciphernote.internal')
    })

    it('handles maximum length username (32 chars)', () => {
      const username = 'a'.repeat(32)
      expect(toSupabaseEmail(username)).toBe(`${username}@ciphernote.internal`)
    })

    it('rejects usernames that are too short', () => {
      expect(() => toSupabaseEmail('ab')).toThrow('Invalid username')
    })

    it('rejects usernames that are too long', () => {
      expect(() => toSupabaseEmail('a'.repeat(33))).toThrow('Invalid username')
    })

    it('rejects usernames with special characters', () => {
      expect(() => toSupabaseEmail('user@name')).toThrow('Invalid username')
      expect(() => toSupabaseEmail('user name')).toThrow('Invalid username')
      expect(() => toSupabaseEmail('user!')).toThrow('Invalid username')
    })

    it('roundtrips with fromSupabaseEmail', () => {
      const username = 'test_user'
      expect(fromSupabaseEmail(toSupabaseEmail(username))).toBe(username)
    })
  })

  describe('fromSupabaseEmail', () => {
    it('extracts username from ciphernote.internal email', () => {
      expect(fromSupabaseEmail('alice@ciphernote.internal')).toBe('alice')
    })

    it('handles uppercase username that was lowercased', () => {
      expect(fromSupabaseEmail('alice@ciphernote.internal')).toBe('alice')
    })

    it('returns non-ciphernote emails unchanged', () => {
      expect(fromSupabaseEmail('alice@gmail.com')).toBe('alice@gmail.com')
    })

    it('does not strip embedded domain occurrences', () => {
      expect(fromSupabaseEmail('x@ciphernote.internal@ciphernote.internal')).toBe('x@ciphernote.internal')
    })
  })

  describe('isCiphernoteInternalEmail', () => {
    it('returns true for ciphernote.internal emails', () => {
      expect(isCiphernoteInternalEmail('alice@ciphernote.internal')).toBe(true)
    })

    it('returns false for other email domains', () => {
      expect(isCiphernoteInternalEmail('alice@gmail.com')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isCiphernoteInternalEmail('')).toBe(false)
    })

    it('returns false for partial matches', () => {
      expect(isCiphernoteInternalEmail('alice@notciphernote.internal')).toBe(false)
    })
  })
})
