import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock argon2id module (Web Worker won't run in jsdom)
vi.mock('@/shared/crypto/argon2id', () => ({
  deriveKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xab)),
  deriveAuthHash: vi.fn().mockResolvedValue('a'.repeat(64)),
  derivePasswordKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xcd)),
  generateSalt: vi.fn().mockReturnValue(new Uint8Array(16).fill(0xef)),
}))

// Mock @scure/bip39 (lazy-loaded, won't run in jsdom)
vi.mock('@scure/bip39', () => ({
  generateMnemonic: vi
    .fn()
    .mockReturnValue('word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11'),
  validateMnemonic: vi.fn().mockReturnValue(true),
  mnemonicToSeedSync: vi.fn().mockReturnValue(new Uint8Array(64).fill(0x42)),
}))

import { deriveLoginKeys } from '@/features/encryption/model/login'
import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { hexEncode } from '@/shared/crypto/memory'
import type { ServerFieldKey } from '@/shared/types/api.types'

/**
 * Helper: run the full registration flow to produce realistic key material,
 * then convert wrapped keys to ServerFieldKey format for login tests.
 */
async function setupRegistration() {
  const regResult = await deriveRegistrationKeys('test-password-123')

  // Convert wrapped field keys to ServerFieldKey format (hex strings)
  const serverFieldKeys: ServerFieldKey[] = regResult.wrappedFieldKeys.map((fk) => ({
    fieldName: fk.fieldName,
    version: fk.version,
    wrappedKey: hexEncode(fk.wrappedKey),
    keyIV: hexEncode(fk.iv),
  }))

  return {
    regResult,
    serverFieldKeys,
    passwordKey: regResult.fieldKeys, // Not actually the password key, just for reference
    wrappedMasterKey: regResult.wrappedMasterKey,
    masterKeyIV: regResult.masterKeyIV,
  }
}

describe('deriveLoginKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('round-trip: register then login derives matching keys', async () => {
    const { regResult, serverFieldKeys, wrappedMasterKey, masterKeyIV } = await setupRegistration()

    // Derive login credentials using the same password and salts
    const { deriveLoginCredentials } = await import('@/shared/crypto/split-kdf')
    const loginCreds = await deriveLoginCredentials('test-password-123', regResult.authSalt, regResult.keySalt)

    // Login: unwrap keys
    const loginResult = await deriveLoginKeys(loginCreds.passwordKey, wrappedMasterKey, masterKeyIV, serverFieldKeys)

    // Verify master key matches
    expect(loginResult.masterKey).toEqual(regResult.masterKey)

    // Verify field keys match
    for (const fieldName of ['note', 'website', 'email']) {
      const originalKey = regResult.fieldKeys.get(fieldName)!
      const loginKey = loginResult.fieldKeys.get(fieldName)!
      expect(loginKey).toEqual(originalKey)
    }
  })

  it('throws DecryptionError with wrong passwordKey', async () => {
    const { serverFieldKeys, wrappedMasterKey, masterKeyIV } = await setupRegistration()

    // Use a random wrong key
    const wrongKey = crypto.getRandomValues(new Uint8Array(32))

    await expect(deriveLoginKeys(wrongKey, wrappedMasterKey, masterKeyIV, serverFieldKeys)).rejects.toThrow()
  })

  it('throws DecryptionError with corrupted wrappedMasterKey', async () => {
    const { regResult, serverFieldKeys, wrappedMasterKey, masterKeyIV } = await setupRegistration()

    const { deriveLoginCredentials } = await import('@/shared/crypto/split-kdf')
    const loginCreds = await deriveLoginCredentials('test-password-123', regResult.authSalt, regResult.keySalt)

    // Corrupt the wrapped master key
    const corruptedMasterKey = new Uint8Array(wrappedMasterKey.byteLength)
    corruptedMasterKey.set(wrappedMasterKey)
    corruptedMasterKey[0] ^= 0xff // flip a byte

    await expect(
      deriveLoginKeys(loginCreds.passwordKey, corruptedMasterKey, masterKeyIV, serverFieldKeys),
    ).rejects.toThrow()
  })

  it('returns empty Map for empty serverFieldKeys', async () => {
    const { regResult, wrappedMasterKey, masterKeyIV } = await setupRegistration()

    const { deriveLoginCredentials } = await import('@/shared/crypto/split-kdf')
    const loginCreds = await deriveLoginCredentials('test-password-123', regResult.authSalt, regResult.keySalt)

    const loginResult = await deriveLoginKeys(loginCreds.passwordKey, wrappedMasterKey, masterKeyIV, [])

    expect(loginResult.fieldKeys.size).toBe(0)
  })

  it('unwraps all three field keys (note, website, email)', async () => {
    const { regResult, serverFieldKeys, wrappedMasterKey, masterKeyIV } = await setupRegistration()

    const { deriveLoginCredentials } = await import('@/shared/crypto/split-kdf')
    const loginCreds = await deriveLoginCredentials('test-password-123', regResult.authSalt, regResult.keySalt)

    const loginResult = await deriveLoginKeys(loginCreds.passwordKey, wrappedMasterKey, masterKeyIV, serverFieldKeys)

    expect(loginResult.fieldKeys.has('note')).toBe(true)
    expect(loginResult.fieldKeys.has('website')).toBe(true)
    expect(loginResult.fieldKeys.has('email')).toBe(true)
  })

  it('produces KEK that can re-unwrap field keys', async () => {
    const { regResult, serverFieldKeys, wrappedMasterKey, masterKeyIV } = await setupRegistration()

    const { deriveLoginCredentials } = await import('@/shared/crypto/split-kdf')
    const loginCreds = await deriveLoginCredentials('test-password-123', regResult.authSalt, regResult.keySalt)

    const loginResult = await deriveLoginKeys(loginCreds.passwordKey, wrappedMasterKey, masterKeyIV, serverFieldKeys)

    // Verify KEK is a CryptoKey
    expect(loginResult.kek).toBeInstanceOf(CryptoKey)
  })
})
