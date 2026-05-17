import { describe, it, expect } from 'vitest'
import { toSupabaseEmail, fromSupabaseEmail, isCiphernoteInternalEmail } from './username-utils'

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
