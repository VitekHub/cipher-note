import { describe, it, expect } from 'vitest'
import { hexEncode, hexDecode, zeroFill } from '@/shared/crypto/memory'

describe('memory', () => {
  describe('hexEncode', () => {
    it('encodes 16-byte input to 32-char hex string', () => {
      const data = new Uint8Array(16).fill(0xab)
      const result = hexEncode(data)
      expect(result).toHaveLength(32)
      expect(result).toBe('ab'.repeat(16))
    })

    it('encodes 32-byte input to 64-char hex string', () => {
      const data = new Uint8Array(32).fill(0xcd)
      const result = hexEncode(data)
      expect(result).toHaveLength(64)
      expect(result).toBe('cd'.repeat(32))
    })

    it('encodes 12-byte input to 24-char hex string', () => {
      const data = new Uint8Array(12).fill(0xef)
      const result = hexEncode(data)
      expect(result).toHaveLength(24)
      expect(result).toBe('ef'.repeat(12))
    })

    it('encodes 48-byte input to 96-char hex string', () => {
      const data = new Uint8Array(48).fill(0x01)
      const result = hexEncode(data)
      expect(result).toHaveLength(96)
      expect(result).toBe('01'.repeat(48))
    })

    it('encodes zero bytes to all-zeros hex', () => {
      const data = new Uint8Array(4)
      expect(hexEncode(data)).toBe('00000000')
    })

    it('uses lowercase hex digits', () => {
      const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
      expect(hexEncode(data)).toBe('deadbeef')
    })
  })

  describe('hexDecode', () => {
    it('decodes 32-char hex to 16-byte Uint8Array', () => {
      const hex = 'ab'.repeat(16)
      const result = hexDecode(hex)
      expect(result).toHaveLength(16)
      expect(Array.from(result)).toEqual(Array(16).fill(0xab))
    })

    it('decodes 64-char hex to 32-byte Uint8Array', () => {
      const hex = 'cd'.repeat(32)
      const result = hexDecode(hex)
      expect(result).toHaveLength(32)
      expect(Array.from(result)).toEqual(Array(32).fill(0xcd))
    })

    it('round-trips with hexEncode', () => {
      const original = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef])
      const encoded = hexEncode(original)
      const decoded = hexDecode(encoded)
      expect(decoded).toEqual(original)
    })

    it('throws on odd-length input', () => {
      expect(() => hexDecode('abc')).toThrow('odd-length input')
    })

    it('throws on non-hex characters', () => {
      expect(() => hexDecode('zz')).toThrow('non-hex character')
    })

    it('accepts uppercase hex', () => {
      const result = hexDecode('DEADBEEF')
      expect(Array.from(result)).toEqual([0xde, 0xad, 0xbe, 0xef])
    })
  })

  describe('zeroFill', () => {
    it('fills all bytes with zero', () => {
      const buffer = new Uint8Array([0xff, 0xab, 0xcd, 0xef])
      zeroFill(buffer)
      expect(Array.from(buffer)).toEqual([0, 0, 0, 0])
    })

    it('does not change array length', () => {
      const buffer = new Uint8Array(32).fill(0x42)
      zeroFill(buffer)
      expect(buffer).toHaveLength(32)
    })

    it('handles empty array', () => {
      const buffer = new Uint8Array(0)
      zeroFill(buffer)
      expect(buffer).toHaveLength(0)
    })
  })
})
