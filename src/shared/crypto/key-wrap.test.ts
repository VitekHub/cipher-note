import { describe, it, expect } from 'vitest'
import { wrapKey, unwrapKey, encodeAAD } from '@/shared/crypto/key-wrap'
import { generateKey } from '@/shared/crypto/aes-gcm'
import { DecryptionError } from '@/shared/crypto/errors'

describe('wrapKey + unwrapKey', () => {
  it('round-trips a 32-byte key', async () => {
    const wrappingKey = await generateKey()
    const plaintextKey = crypto.getRandomValues(new Uint8Array(32))
    const aad = encodeAAD('note', 1)
    const { wrappedKey, iv } = await wrapKey(plaintextKey, wrappingKey, aad)
    const unwrapped = await unwrapKey(wrappedKey, wrappingKey, iv, aad)
    expect(unwrapped).toEqual(plaintextKey)
  })

  it('throws DecryptionError with wrong wrapping key', async () => {
    const key1 = await generateKey()
    const key2 = await generateKey()
    const plaintextKey = crypto.getRandomValues(new Uint8Array(32))
    const aad = encodeAAD('note', 1)
    const { wrappedKey, iv } = await wrapKey(plaintextKey, key1, aad)
    await expect(unwrapKey(wrappedKey, key2, iv, aad)).rejects.toThrow(DecryptionError)
  })

  it('throws DecryptionError with wrong AAD (different version) — rollback protection', async () => {
    const wrappingKey = await generateKey()
    const plaintextKey = crypto.getRandomValues(new Uint8Array(32))
    const aadV1 = encodeAAD('note', 1)
    const aadV2 = encodeAAD('note', 2)
    const { wrappedKey, iv } = await wrapKey(plaintextKey, wrappingKey, aadV1)
    await expect(unwrapKey(wrappedKey, wrappingKey, iv, aadV2)).rejects.toThrow(DecryptionError)
  })

  it('throws DecryptionError with tampered wrapped key', async () => {
    const wrappingKey = await generateKey()
    const plaintextKey = crypto.getRandomValues(new Uint8Array(32))
    const aad = encodeAAD('note', 1)
    const { wrappedKey, iv } = await wrapKey(plaintextKey, wrappingKey, aad)
    const tampered = new Uint8Array(wrappedKey)
    tampered[0] ^= 0xff
    await expect(unwrapKey(tampered, wrappingKey, iv, aad)).rejects.toThrow(DecryptionError)
  })

  it('throws DecryptionError with wrong IV', async () => {
    const wrappingKey = await generateKey()
    const plaintextKey = crypto.getRandomValues(new Uint8Array(32))
    const aad = encodeAAD('note', 1)
    const { wrappedKey } = await wrapKey(plaintextKey, wrappingKey, aad)
    const wrongIV = crypto.getRandomValues(new Uint8Array(12))
    await expect(unwrapKey(wrappedKey, wrappingKey, wrongIV, aad)).rejects.toThrow(DecryptionError)
  })

  it('different AAD values produce different wrapped keys', async () => {
    const wrappingKey = await generateKey()
    const plaintextKey = crypto.getRandomValues(new Uint8Array(32))
    const aadV1 = encodeAAD('note', 1)
    const aadV2 = encodeAAD('note', 2)
    const aadV3 = encodeAAD('website', 1)
    const result1 = await wrapKey(plaintextKey, wrappingKey, aadV1)
    const result2 = await wrapKey(plaintextKey, wrappingKey, aadV2)
    const result3 = await wrapKey(plaintextKey, wrappingKey, aadV3)
    expect(result1.wrappedKey).not.toEqual(result2.wrappedKey)
    expect(result1.wrappedKey).not.toEqual(result3.wrappedKey)
    expect(result2.wrappedKey).not.toEqual(result3.wrappedKey)
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
})
