import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, importKey, exportKey } from '@/shared/crypto/aes-gcm'
import { DecryptionError } from '@/shared/crypto/errors'

const generateKey = async () => await importKey(crypto.getRandomValues(new Uint8Array(32)), true)

describe('encrypt + decrypt', () => {
  it('round-trips plaintext', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([72, 101, 108, 108, 111])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad = new Uint8Array([1, 2, 3])
    const ciphertext = await encrypt(plaintext, key, { iv, aad })
    const decrypted = await decrypt(ciphertext, key, { iv, aad })
    expect(decrypted).toEqual(plaintext)
  })

  it('produces different ciphertexts for different IVs', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const aad = new Uint8Array([4, 5, 6])
    const iv1 = crypto.getRandomValues(new Uint8Array(12))
    const iv2 = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext1 = await encrypt(plaintext, key, { iv: iv1, aad })
    const ciphertext2 = await encrypt(plaintext, key, { iv: iv2, aad })
    expect(ciphertext1).not.toEqual(ciphertext2)
  })
})

describe('decrypt error handling', () => {
  it('throws DecryptionError with wrong key', async () => {
    const key1 = await generateKey()
    const key2 = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad = new Uint8Array([4, 5, 6])
    const ciphertext = await encrypt(plaintext, key1, { iv, aad })
    await expect(decrypt(ciphertext, key2, { iv, aad })).rejects.toThrow(DecryptionError)
  })

  it('throws DecryptionError with wrong IV', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad = new Uint8Array([4, 5, 6])
    const ciphertext = await encrypt(plaintext, key, { iv, aad })
    const wrongIV = crypto.getRandomValues(new Uint8Array(12))
    await expect(decrypt(ciphertext, key, { iv: wrongIV, aad })).rejects.toThrow(DecryptionError)
  })

  it('throws DecryptionError with tampered ciphertext', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad = new Uint8Array([4, 5, 6])
    const ciphertext = await encrypt(plaintext, key, { iv, aad })
    const tampered = new Uint8Array(ciphertext)
    tampered[0] ^= 0xff
    await expect(decrypt(tampered, key, { iv, aad })).rejects.toThrow(DecryptionError)
  })

  it('preserves original error as cause', async () => {
    const key1 = await generateKey()
    const key2 = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad = new Uint8Array([4, 5, 6])
    const ciphertext = await encrypt(plaintext, key1, { iv, aad })
    try {
      await decrypt(ciphertext, key2, { iv, aad })
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
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const aad = new Uint8Array([1])
      const ciphertext = await encrypt(plaintext, key, { iv, aad })
      const decrypted = await decrypt(ciphertext, key, { iv, aad })
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
    const reimportedKey = await importKey(rawBytes, true)
    const reimportedBytes = await exportKey(reimportedKey)
    expect(reimportedBytes).toEqual(rawBytes)
  })

  it('importKey with non-32-byte key throws', async () => {
    const shortKey = new Uint8Array(16)
    await expect(importKey(shortKey)).rejects.toThrow()
  })

  it('importKey defaults to non-extractable', async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32))
    const key = await importKey(rawKey)
    await expect(exportKey(key)).rejects.toThrow()
  })
})

describe('encrypt + decrypt with AAD', () => {
  it('round-trips plaintext with AAD', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad = new Uint8Array([4, 5, 6])
    const ciphertext = await encrypt(plaintext, key, { iv, aad })
    const decrypted = await decrypt(ciphertext, key, { iv, aad })
    expect(decrypted).toEqual(plaintext)
  })

  it('throws DecryptionError when AAD mismatches', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad1 = new Uint8Array([4, 5, 6])
    const aad2 = new Uint8Array([7, 8, 9])
    const ciphertext = await encrypt(plaintext, key, { iv, aad: aad1 })
    await expect(decrypt(ciphertext, key, { iv, aad: aad2 })).rejects.toThrow(DecryptionError)
  })

  it('different AAD values produce different ciphertexts with same IV', async () => {
    const key = await generateKey()
    const plaintext = new Uint8Array([1, 2, 3])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad1 = new Uint8Array([4, 5, 6])
    const aad2 = new Uint8Array([7, 8, 9])
    const ciphertext1 = await encrypt(plaintext, key, { iv, aad: aad1 })
    const ciphertext2 = await encrypt(plaintext, key, { iv, aad: aad2 })
    expect(ciphertext1).not.toEqual(ciphertext2)
  })
})
