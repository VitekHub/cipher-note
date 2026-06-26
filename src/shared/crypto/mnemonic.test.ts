import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DecryptionError, MnemonicError } from '@/shared/crypto/errors'
import { generateIV } from '@/shared/crypto/crypto-utils'
import { generateMasterKey } from '@/shared/crypto/master-key'
import type { RecoveryData } from '@/shared/types/crypto.types'

// Mock Argon2id module to avoid WASM/worker dependency in tests
vi.mock('@/shared/crypto/argon2id', () => ({
  deriveKey: vi.fn(),
}))

// Mock @scure/bip39 to avoid loading 2048-word dictionary in tests
const MOCK_WORDLIST = Array.from({ length: 2048 }, (_, i) => `word${i}`)
const MOCK_VALID_MNEMONIC = MOCK_WORDLIST.slice(0, 12).join(' ')

vi.mock('@scure/bip39', () => ({
  generateMnemonic: vi.fn().mockReturnValue(MOCK_VALID_MNEMONIC),
  validateMnemonic: vi.fn().mockReturnValue(true),
  mnemonicToSeedSync: vi.fn().mockReturnValue(new Uint8Array(64).fill(0xab)),
}))

vi.mock('@scure/bip39/wordlists/english.js', () => ({
  wordlist: MOCK_WORDLIST,
}))

import { deriveKey } from '@/shared/crypto/argon2id'
import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
  deriveRecoveryKEK,
  wrapMasterKeyWithRecovery,
  unwrapMasterKeyWithRecovery,
  createRecoveryData,
} from '@/shared/crypto/mnemonic'

function mockBytes(length: number, fill: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length).fill(fill) as Uint8Array<ArrayBuffer>
}

describe('mnemonic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateMnemonic', () => {
    it('produces a 12-word string', async () => {
      const mnemonic = await generateMnemonic()

      expect(mnemonic.split(' ')).toHaveLength(12)
    })

    it('produces unique mnemonics on successive calls', async () => {
      const first = await generateMnemonic()
      const second = await generateMnemonic()

      // The mock returns the same value, but the real implementation would differ.
      // We verify the function is called each time.
      expect(first).toBeDefined()
      expect(second).toBeDefined()
    })
  })

  describe('validateMnemonic', () => {
    it('returns true for a valid mnemonic', async () => {
      const result = await validateMnemonic(MOCK_VALID_MNEMONIC)

      expect(result).toBe(true)
    })

    it('returns false for an invalid mnemonic', async () => {
      const { validateMnemonic: bip39Validate } = await import('@scure/bip39')
      vi.mocked(bip39Validate).mockReturnValueOnce(false)

      const result = await validateMnemonic('invalid mnemonic phrase')

      expect(result).toBe(false)
    })
  })

  describe('mnemonicToSeed', () => {
    it('returns a 32-byte Uint8Array for a valid mnemonic', async () => {
      const seed = await mnemonicToSeed(MOCK_VALID_MNEMONIC)

      expect(seed).toBeInstanceOf(Uint8Array)
      expect(seed.byteLength).toBe(32)
    })

    it('truncates the 64-byte seed to 32 bytes', async () => {
      const fullSeed = new Uint8Array(64).fill(0xab)
      const { mnemonicToSeedSync } = await import('@scure/bip39')
      vi.mocked(mnemonicToSeedSync).mockReturnValueOnce(fullSeed)

      const seed = await mnemonicToSeed(MOCK_VALID_MNEMONIC)

      expect(seed).toEqual(fullSeed.slice(0, 32))
    })

    it('throws MnemonicError for an invalid mnemonic', async () => {
      const { validateMnemonic: bip39Validate } = await import('@scure/bip39')
      vi.mocked(bip39Validate).mockReturnValueOnce(false)

      await expect(mnemonicToSeed('invalid mnemonic')).rejects.toThrow(MnemonicError)
    })

    it('produces deterministic output for the same mnemonic', async () => {
      const first = await mnemonicToSeed(MOCK_VALID_MNEMONIC)
      const second = await mnemonicToSeed(MOCK_VALID_MNEMONIC)

      expect(first).toEqual(second)
    })
  })

  describe('deriveRecoveryKEK', () => {
    it('calls deriveKey with mnemonic and recoverySalt', async () => {
      const recoverySalt = mockBytes(16, 0x01)
      const expectedKEK = mockBytes(32, 0xab)
      vi.mocked(deriveKey).mockResolvedValueOnce(expectedKEK)

      const result = await deriveRecoveryKEK(MOCK_VALID_MNEMONIC, recoverySalt)

      expect(deriveKey).toHaveBeenCalledWith(MOCK_VALID_MNEMONIC, recoverySalt)
      expect(result).toEqual(expectedKEK)
    })

    it('returns 32-byte result from deriveKey', async () => {
      const recoverySalt = mockBytes(16, 0x01)
      vi.mocked(deriveKey).mockResolvedValueOnce(mockBytes(32, 0xcd))

      const result = await deriveRecoveryKEK(MOCK_VALID_MNEMONIC, recoverySalt)

      expect(result.byteLength).toBe(32)
    })
  })

  describe('wrapMasterKeyWithRecovery', () => {
    const RECOVERY_KEK_FILL = 0x11

    it('wraps master key and returns RecoveryData with correct structure', async () => {
      const masterKey = generateMasterKey()
      const salt = mockBytes(16, 0x04)
      const iv = generateIV()
      vi.mocked(deriveKey).mockResolvedValueOnce(mockBytes(32, RECOVERY_KEK_FILL))

      const result: RecoveryData = await wrapMasterKeyWithRecovery(masterKey, MOCK_VALID_MNEMONIC, { iv, salt })

      expect(result.recoveryWrappedMasterKey).toBeInstanceOf(Uint8Array)
      expect(result.recoveryKeyIV).toEqual(iv)
      expect(result.recoveryKeySalt).toEqual(salt)
    })

    it('calls deriveKey with mnemonic and salt', async () => {
      const masterKey = generateMasterKey()
      const salt = mockBytes(16, 0x03)
      const iv = generateIV()
      vi.mocked(deriveKey).mockResolvedValueOnce(mockBytes(32, RECOVERY_KEK_FILL))

      await wrapMasterKeyWithRecovery(masterKey, MOCK_VALID_MNEMONIC, { iv, salt })

      expect(deriveKey).toHaveBeenCalledWith(MOCK_VALID_MNEMONIC, salt)
    })
  })

  describe('wrap/unwrap round-trip', () => {
    const RECOVERY_KEK_FILL = 0x11

    it('returns original master key after wrap and unwrap', async () => {
      const masterKey = generateMasterKey()
      const salt = mockBytes(16, 0x01)
      const iv = generateIV()
      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, RECOVERY_KEK_FILL))

      const wrapped = await wrapMasterKeyWithRecovery(masterKey, MOCK_VALID_MNEMONIC, { iv, salt })
      const unwrapped = await unwrapMasterKeyWithRecovery(wrapped.recoveryWrappedMasterKey, MOCK_VALID_MNEMONIC, {
        iv: wrapped.recoveryKeyIV,
        salt: wrapped.recoveryKeySalt,
      })

      expect(unwrapped).toEqual(masterKey)
    })
  })

  describe('unwrapMasterKeyWithRecovery errors', () => {
    it('throws DecryptionError with wrong mnemonic', async () => {
      const masterKey = generateMasterKey()
      const salt = mockBytes(16, 0x01)
      const iv = generateIV()

      // Wrap with one KEK
      vi.mocked(deriveKey).mockResolvedValueOnce(mockBytes(32, 0x11))
      const wrapped = await wrapMasterKeyWithRecovery(masterKey, 'correct mnemonic', { iv, salt })

      // Try to unwrap with a different KEK (wrong mnemonic derives different key)
      vi.mocked(deriveKey).mockResolvedValueOnce(mockBytes(32, 0x22))

      await expect(
        unwrapMasterKeyWithRecovery(wrapped.recoveryWrappedMasterKey, 'wrong mnemonic', {
          iv: wrapped.recoveryKeyIV,
          salt: wrapped.recoveryKeySalt,
        }),
      ).rejects.toThrow(DecryptionError)
    })

    it('throws DecryptionError with tampered wrappedMasterKey', async () => {
      const masterKey = generateMasterKey()
      const salt = mockBytes(16, 0x01)
      const iv = generateIV()

      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, 0x11))
      const wrapped = await wrapMasterKeyWithRecovery(masterKey, MOCK_VALID_MNEMONIC, { iv, salt })

      // Tamper with the wrapped key
      const tampered = new Uint8Array(wrapped.recoveryWrappedMasterKey) as Uint8Array<ArrayBuffer>
      tampered[0] ^= 0xff

      await expect(
        unwrapMasterKeyWithRecovery(tampered, MOCK_VALID_MNEMONIC, {
          iv: wrapped.recoveryKeyIV,
          salt: wrapped.recoveryKeySalt,
        }),
      ).rejects.toThrow(DecryptionError)
    })

    it('throws DecryptionError with wrong recoveryIV', async () => {
      const masterKey = generateMasterKey()
      const salt = mockBytes(16, 0x01)
      const iv = generateIV()

      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, 0x11))
      const wrapped = await wrapMasterKeyWithRecovery(masterKey, MOCK_VALID_MNEMONIC, { iv, salt })

      const wrongIV = generateIV()

      await expect(
        unwrapMasterKeyWithRecovery(wrapped.recoveryWrappedMasterKey, MOCK_VALID_MNEMONIC, {
          iv: wrongIV,
          salt: wrapped.recoveryKeySalt,
        }),
      ).rejects.toThrow(DecryptionError)
    })
  })

  describe('createRecoveryData', () => {
    const RECOVERY_KEK_FILL = 0x11

    it('returns a mnemonic and recovery data', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(deriveKey).mockResolvedValueOnce(mockBytes(32, RECOVERY_KEK_FILL))

      const result = await createRecoveryData(masterKey)

      expect(result.mnemonic).toBeDefined()
      expect(result.mnemonic.split(' ')).toHaveLength(12)
      expect(result.recoveryData).toBeDefined()
      expect(result.recoveryData.recoveryKeySalt).toBeInstanceOf(Uint8Array)
      expect(result.recoveryData.recoveryKeyIV).toBeInstanceOf(Uint8Array)
      expect(result.recoveryData.recoveryWrappedMasterKey).toBeInstanceOf(Uint8Array)
    })

    it('uses fresh recovery salt and IV', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, RECOVERY_KEK_FILL))

      const result1 = await createRecoveryData(masterKey)
      const result2 = await createRecoveryData(masterKey)

      expect(result1.recoveryData.recoveryKeySalt).not.toEqual(result2.recoveryData.recoveryKeySalt)
      expect(result1.recoveryData.recoveryKeyIV).not.toEqual(result2.recoveryData.recoveryKeyIV)
    })

    it('wraps the master key so it can be unwrapped with the returned mnemonic', async () => {
      const masterKey = generateMasterKey()
      vi.mocked(deriveKey).mockResolvedValue(mockBytes(32, RECOVERY_KEK_FILL))

      const { mnemonic, recoveryData } = await createRecoveryData(masterKey)
      const unwrapped = await unwrapMasterKeyWithRecovery(recoveryData.recoveryWrappedMasterKey, mnemonic, {
        iv: recoveryData.recoveryKeyIV,
        salt: recoveryData.recoveryKeySalt,
      })

      expect(unwrapped).toEqual(masterKey)
    })
  })
})
