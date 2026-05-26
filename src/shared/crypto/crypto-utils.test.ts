import { describe, it, expect } from 'vitest'
import {
  hexEncode,
  hexDecode,
  zeroFill,
  copyToUint8Array,
  generateIV,
  generateSalt,
  generateKey,
  encodeAAD,
} from '@/shared/crypto/crypto-utils'

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

  describe('copyToUint8Array', () => {
    it('copies ArrayBuffer data correctly', () => {
      const buffer = new ArrayBuffer(4)
      const view = new Uint8Array(buffer)
      view.set([0xde, 0xad, 0xbe, 0xef])
      const copy = copyToUint8Array(buffer)
      expect(Array.from(copy)).toEqual([0xde, 0xad, 0xbe, 0xef])
    })

    it('copies Uint8Array data correctly', () => {
      const original = new Uint8Array([0x01, 0x02, 0x03])
      const copy = copyToUint8Array(original)
      expect(Array.from(copy)).toEqual([0x01, 0x02, 0x03])
    })

    it('returns an independent copy from Uint8Array', () => {
      const original = new Uint8Array([0xaa, 0xbb])
      const copy = copyToUint8Array(original)
      original[0] = 0xff
      expect(copy[0]).toBe(0xaa)
    })

    it('returns an independent copy from ArrayBuffer', () => {
      const buffer = new ArrayBuffer(4)
      new Uint8Array(buffer).set([0xde, 0xad, 0xbe, 0xef])
      const copy = copyToUint8Array(buffer)
      new Uint8Array(buffer)[0] = 0xff
      expect(copy[0]).toBe(0xde)
    })

    it('handles empty input', () => {
      const copy = copyToUint8Array(new Uint8Array(0))
      expect(copy).toHaveLength(0)
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

  describe('generateIV', () => {
    it('returns a 12-byte Uint8Array', () => {
      const iv = generateIV()
      expect(iv).toBeInstanceOf(Uint8Array)
      expect(iv).toHaveLength(12)
    })

    it('produces unique values on each call', () => {
      const iv1 = generateIV()
      const iv2 = generateIV()
      expect(iv1).not.toEqual(iv2)
    })
  })

  describe('generateSalt', () => {
    it('returns a 16-byte Uint8Array', () => {
      const salt = generateSalt()
      expect(salt).toBeInstanceOf(Uint8Array)
      expect(salt).toHaveLength(16)
    })

    it('produces unique values on each call', () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      expect(salt1).not.toEqual(salt2)
    })
  })

  describe('generateKey', () => {
    it('returns a 32-byte Uint8Array', () => {
      const key = generateKey()
      expect(key).toBeInstanceOf(Uint8Array)
      expect(key).toHaveLength(32)
    })

    it('produces unique values on each call', () => {
      const key1 = generateKey()
      const key2 = generateKey()
      expect(key1).not.toEqual(key2)
    })
  })
})

describe('encodeAAD', () => {
  it('produces different bytes for different versions of same field', () => {
    expect(encodeAAD('note', 1)).not.toEqual(encodeAAD('note', 2))
  })

  it('produces different bytes for same version of different fields', () => {
    expect(encodeAAD('note', 1)).not.toEqual(encodeAAD('website', 1))
  })

  it('produces different bytes for all three combinations', () => {
    const a1 = encodeAAD('note', 1)
    const a2 = encodeAAD('note', 2)
    const a3 = encodeAAD('website', 1)
    expect(a1).not.toEqual(a2)
    expect(a1).not.toEqual(a3)
    expect(a2).not.toEqual(a3)
  })

  it('is deterministic for same inputs', () => {
    expect(encodeAAD('note', 1)).toEqual(encodeAAD('note', 1))
  })

  it('encodes AAD as [2-byte name length BE][name UTF-8][4-byte version BE]', () => {
    expect(encodeAAD('ab', 1)).toEqual(new Uint8Array([0, 2, 97, 98, 0, 0, 0, 1]))
  })

  it('throws on negative version', () => {
    expect(() => encodeAAD('note', -1)).toThrow('Version must be non-negative')
  })

  it('throws on field name exceeding 255 bytes', () => {
    const longName = 'a'.repeat(256)
    expect(() => encodeAAD(longName, 1)).toThrow('Field name too long')
  })
})
