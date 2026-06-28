import { describe, it, expect } from 'vitest'
import { hkdfExpand, deriveKEK, deriveSigningKeySeed, HKDF_INFO } from '@/shared/crypto/core/hkdf'

describe('hkdf', () => {
  function generateKey(): Uint8Array<ArrayBuffer> {
    return crypto.getRandomValues(new Uint8Array(32))
  }

  describe('hkdfExpand', () => {
    it('produces deterministic output for same master key and info', async () => {
      const masterKey = generateKey()
      const result1 = await hkdfExpand(masterKey, 'wrap')
      const result2 = await hkdfExpand(masterKey, 'wrap')
      expect(result1).toEqual(result2)
    })

    it('produces different output for different info strings', async () => {
      const masterKey = generateKey()
      const wrap = await hkdfExpand(masterKey, 'wrap')
      const sign = await hkdfExpand(masterKey, 'sign')
      expect(wrap).not.toEqual(sign)
    })

    it('produces different output for different master keys with same info', async () => {
      const key1 = generateKey()
      const key2 = generateKey()
      const result1 = await hkdfExpand(key1, 'wrap')
      const result2 = await hkdfExpand(key2, 'wrap')
      expect(result1).not.toEqual(result2)
    })

    it('returns 32 bytes by default', async () => {
      const masterKey = generateKey()
      const result = await hkdfExpand(masterKey, 'wrap')
      expect(result.length).toBe(32)
    })

    it('respects custom length parameter', async () => {
      const masterKey = generateKey()
      const result16 = await hkdfExpand(masterKey, 'wrap', 16)
      const result64 = await hkdfExpand(masterKey, 'wrap', 64)
      expect(result16.length).toBe(16)
      expect(result64.length).toBe(64)
    })

    it('produces different output for each unique info string', async () => {
      const masterKey = generateKey()
      const infos = ['wrap', 'sign', 'note', 'website', 'email']
      const results = await Promise.all(infos.map((info) => hkdfExpand(masterKey, info)))
      for (let i = 0; i < results.length; i++) {
        for (let j = i + 1; j < results.length; j++) {
          expect(results[i]).not.toEqual(results[j])
        }
      }
    })

    it('handles empty info string', async () => {
      const masterKey = generateKey()
      const result = await hkdfExpand(masterKey, '')
      expect(result.length).toBe(32)
      const result2 = await hkdfExpand(masterKey, '')
      expect(result).toEqual(result2)
    })

    it('throws for non-32-byte master key', async () => {
      const shortKey = crypto.getRandomValues(new Uint8Array(16))
      await expect(hkdfExpand(shortKey, 'wrap')).rejects.toThrow('Invalid PRK length: expected 32 bytes, got 16')
    })
  })

  describe('deriveKEK', () => {
    it('returns 32-byte derived key', async () => {
      const masterKey = generateKey()
      const kek = await deriveKEK(masterKey)
      expect(kek.length).toBe(32)
    })

    it('is consistent with hkdfExpand(masterKey, HKDF_INFO.KEK)', async () => {
      const masterKey = generateKey()
      const kek = await deriveKEK(masterKey)
      const direct = await hkdfExpand(masterKey, HKDF_INFO.KEK)
      expect(kek).toEqual(direct)
    })
  })

  describe('deriveSigningKeySeed', () => {
    it('returns 32-byte derived key', async () => {
      const masterKey = generateKey()
      const seed = await deriveSigningKeySeed(masterKey)
      expect(seed.length).toBe(32)
    })

    it('is consistent with hkdfExpand(masterKey, HKDF_INFO.SIGN)', async () => {
      const masterKey = generateKey()
      const seed = await deriveSigningKeySeed(masterKey)
      const direct = await hkdfExpand(masterKey, HKDF_INFO.SIGN)
      expect(seed).toEqual(direct)
    })

    it('produces different output than deriveKEK for same master key', async () => {
      const masterKey = generateKey()
      const kek = await deriveKEK(masterKey)
      const seed = await deriveSigningKeySeed(masterKey)
      expect(kek).not.toEqual(seed)
    })
  })
})
