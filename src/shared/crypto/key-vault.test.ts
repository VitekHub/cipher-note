import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock crypto store
const mockSetKeys = vi.fn()
const mockLockVault = vi.fn()
const mockClearVault = vi.fn()

const createStoreState = () => ({
  loadedFieldKeys: {} as Record<string, boolean>,
  isVaultLocked: true,
  lastActivity: 0,
  cachedEnvelope: null,
  setKeys: mockSetKeys,
  lockVault: mockLockVault,
  clearVault: mockClearVault,
  setCachedEnvelope: vi.fn(),
  updateActivity: vi.fn(),
})

vi.mock('@/shared/crypto/crypto-store', () => ({
  useCryptoStore: {
    getState: vi.fn(() => createStoreState()),
  },
}))

// Mock argon2id (only terminateWorker is needed)
vi.mock('@/shared/crypto/argon2id', () => ({
  terminateWorker: vi.fn(),
}))

import { keyVault } from '@/shared/crypto/key-vault'

describe('key-vault', () => {
  beforeEach(() => {
    keyVault.zeroKeys()
    vi.clearAllMocks()
  })

  it('stores and retrieves a CryptoKey', async () => {
    const keyData = new Uint8Array(32).fill(0x42)
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

    keyVault.storeKey('test-key', key)

    const retrieved = keyVault.getKey('test-key')
    expect(retrieved).toBe(key)
  })

  it('returns undefined for missing key', () => {
    expect(keyVault.getKey('nonexistent')).toBeUndefined()
  })

  it('keyVault.hasKey returns true for existing key', async () => {
    const keyData = new Uint8Array(32).fill(0x42)
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

    keyVault.storeKey('existing', key)

    expect(keyVault.hasKey('existing')).toBe(true)
  })

  it('keyVault.hasKey returns false for missing key', () => {
    expect(keyVault.hasKey('missing')).toBe(false)
  })

  it('zeroKeys removes all entries', async () => {
    const keyData1 = new Uint8Array(32).fill(0x01)
    const keyData2 = new Uint8Array(32).fill(0x02)

    const key1 = await crypto.subtle.importKey('raw', keyData1, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
    const key2 = await crypto.subtle.importKey('raw', keyData2, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

    keyVault.storeKey('key1', key1)
    keyVault.storeKey('key2', key2)

    keyVault.zeroKeys()

    expect(keyVault.getKey('key1')).toBeUndefined()
    expect(keyVault.getKey('key2')).toBeUndefined()
    expect(keyVault.hasKey('key1')).toBe(false)
    expect(keyVault.hasKey('key2')).toBe(false)
  })

  it('keys are non-extractable (exportKey throws)', async () => {
    const keyData = new Uint8Array(32).fill(0x55)
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

    keyVault.storeKey('non-extractable', key)

    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
  })

  it('zeroKeys is idempotent', () => {
    // Should not throw when clearing empty vault
    keyVault.zeroKeys()
    keyVault.zeroKeys()

    // Verify vault is empty by checking keyVault.hasKey for non-existent keys
    expect(keyVault.hasKey('nonexistent')).toBe(false)
  })

  it('storeFieldKeys stores KEK and field keys in vault', async () => {
    const kekData = new Uint8Array(32).fill(0x01)
    const noteKeyData = new Uint8Array(32).fill(0x10)
    const websiteKeyData = new Uint8Array(32).fill(0x20)
    const emailKeyData = new Uint8Array(32).fill(0x30)

    const kek = await crypto.subtle.importKey('raw', kekData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
    const noteKey = await crypto.subtle.importKey('raw', noteKeyData, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ])
    const websiteKey = await crypto.subtle.importKey('raw', websiteKeyData, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ])
    const emailKey = await crypto.subtle.importKey('raw', emailKeyData, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ])

    const fieldKeys = new Map([
      ['note', noteKey],
      ['website', websiteKey],
      ['email', emailKey],
    ])

    await keyVault.storeFieldKeys(kek, fieldKeys)

    expect(keyVault.getKey('kek')).toBe(kek)
    expect(keyVault.getKey('note')).toBe(noteKey)
    expect(keyVault.getKey('website')).toBe(websiteKey)
    expect(keyVault.getKey('email')).toBe(emailKey)
    expect(mockSetKeys).toHaveBeenCalledWith(['note', 'website', 'email'])
  })
})

describe('keyVault.lockVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls cryptoStore.lockVault', () => {
    keyVault.lockVault()
    expect(mockLockVault).toHaveBeenCalled()
  })
})

describe('keyVault.clearVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls cryptoStore.clearVault', () => {
    keyVault.clearVault()
    expect(mockClearVault).toHaveBeenCalled()
  })
})
