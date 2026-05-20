import { describe, it, expect } from 'vitest'
import { generateIV, encrypt, decrypt, importKey, exportKey, generateKey } from '@/shared/crypto/aes-gcm'
import { DecryptionError } from '@/shared/crypto/errors'

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

describe('encrypt + decrypt', () => {
  it('round-trips plaintext', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([72, 101, 108, 108, 111])
    const { ciphertext, iv } = await encrypt(plaintext, key)
    const decrypted = await decrypt(ciphertext, key, iv)
    expect(decrypted).toEqual(plaintext)
  })

  it('produces different ciphertexts for different IVs', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const iv1 = generateIV()
    const iv2 = generateIV()
    const result1 = await encrypt(plaintext, key, iv1)
    const result2 = await encrypt(plaintext, key, iv2)
    expect(result1.ciphertext).not.toEqual(result2.ciphertext)
  })

  it('generates a random IV when none is provided', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const { iv } = await encrypt(plaintext, key)
    expect(iv).toBeInstanceOf(Uint8Array)
    expect(iv).toHaveLength(12)
  })
})

describe('decrypt error handling', () => {
  it('throws DecryptionError with wrong key', async () => {
    const key1 = await generateKey()
    const key2 = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const { ciphertext, iv } = await encrypt(plaintext, key1)
    await expect(decrypt(ciphertext, key2, iv)).rejects.toThrow(DecryptionError)
  })

  it('throws DecryptionError with wrong IV', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const { ciphertext } = await encrypt(plaintext, key)
    const wrongIV = generateIV()
    await expect(decrypt(ciphertext, key, wrongIV)).rejects.toThrow(DecryptionError)
  })

  it('throws DecryptionError with tampered ciphertext', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const { ciphertext, iv } = await encrypt(plaintext, key)
    const tampered = new Uint8Array(ciphertext)
    tampered[0] ^= 0xff
    await expect(decrypt(tampered, key, iv)).rejects.toThrow(DecryptionError)
  })

  it('preserves original error as cause', async () => {
    const key1 = await generateKey()
    const key2 = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const { ciphertext, iv } = await encrypt(plaintext, key1)
    try {
      await decrypt(ciphertext, key2, iv)
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(DecryptionError)
      expect((error as DecryptionError).cause).toBeDefined()
    }
  })
})

describe('round-trip with various sizes', () => {
  const sizes = [0, 1, 100, 10000]

  for (const size of sizes) {
    it(`round-trips ${size}-byte plaintext`, async () => {
      const key = await generateKey()
      const plaintext = new Uint8Array(size)
      if (size > 0) crypto.getRandomValues(plaintext)
      const { ciphertext, iv } = await encrypt(plaintext, key)
      const decrypted = await decrypt(ciphertext, key, iv)
      expect(decrypted).toEqual(plaintext)
    })
  }
})

describe('key management', () => {
  it('generateKey produces a 256-bit (32-byte) key', async () => {
    const key = await generateKey()
    const rawKey = await exportKey(key)
    expect(rawKey).toHaveLength(32)
  })

  it('importKey and exportKey round-trip preserves key bytes', async () => {
    const originalKey = await generateKey()
    const rawBytes = await exportKey(originalKey)
    const reimportedKey = await importKey(rawBytes)
    const reimportedBytes = await exportKey(reimportedKey)
    expect(reimportedBytes).toEqual(rawBytes)
  })

  it('importKey with non-32-byte key throws', async () => {
    const shortKey = new Uint8Array(16)
    await expect(importKey(shortKey)).rejects.toThrow()
  })
})

describe('encrypt + decrypt with AAD', () => {
  it('round-trips plaintext with AAD', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const aad = new Uint8Array([4, 5, 6])
    const { ciphertext, iv } = await encrypt(plaintext, key, undefined, aad)
    const decrypted = await decrypt(ciphertext, key, iv, aad)
    expect(decrypted).toEqual(plaintext)
  })

  it('throws DecryptionError when AAD mismatches', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const aad1 = new Uint8Array([4, 5, 6])
    const aad2 = new Uint8Array([7, 8, 9])
    const { ciphertext, iv } = await encrypt(plaintext, key, undefined, aad1)
    await expect(decrypt(ciphertext, key, iv, aad2)).rejects.toThrow(DecryptionError)
  })

  it('throws DecryptionError when AAD was used but decryption omits it', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const aad = new Uint8Array([4, 5, 6])
    const { ciphertext, iv } = await encrypt(plaintext, key, undefined, aad)
    await expect(decrypt(ciphertext, key, iv)).rejects.toThrow(DecryptionError)
  })

  it('different AAD values produce different ciphertexts with same IV', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const iv = generateIV()
    const aad1 = new Uint8Array([4, 5, 6])
    const aad2 = new Uint8Array([7, 8, 9])
    const result1 = await encrypt(plaintext, key, iv, aad1)
    const result2 = await encrypt(plaintext, key, iv, aad2)
    expect(result1.ciphertext).not.toEqual(result2.ciphertext)
  })
})
