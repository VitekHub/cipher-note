import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { ServerFieldKey } from '@/shared/types/api.types'

import { keyVault } from '@/shared/crypto/vault/key-vault'
import { deriveKEK } from '@/shared/crypto/core/hkdf'
import { unwrapFieldKeys } from '@/shared/crypto/keys/field-keys'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { unwrapMasterKeyWithPassword } from '@/shared/crypto/keys/master-key'
import { derivePasswordKey } from '@/shared/crypto/keys/split-kdf'
import { fetchFreshEnvelope, fetchFieldKeys } from '@/shared/api/supabase-keys'

// Shared mock data used across legacy key vault tests
const { mockEnvelopeData, mockFieldKeysData } = vi.hoisted(() => ({
  mockEnvelopeData: {
    kdfSalt: '01'.repeat(16),
    wrappedMasterKey: '05'.repeat(48),
    masterKeyIV: '06'.repeat(12),
  },
  mockFieldKeysData: [
    { fieldName: 'note', version: 1, wrappedFieldKey: 'aa'.repeat(48), fieldKeyIV: 'bb'.repeat(12) },
    { fieldName: 'website', version: 1, wrappedFieldKey: 'cc'.repeat(48), fieldKeyIV: 'dd'.repeat(12) },
    { fieldName: 'email', version: 1, wrappedFieldKey: 'ee'.repeat(48), fieldKeyIV: 'ff'.repeat(12) },
  ],
}))

// Unified mock store helpers
const mockMarkKeysLoaded = vi.fn()
const mockSetEnvelope = vi.fn()
const mockLockVault = vi.fn()
const mockClearVault = vi.fn()

const cryptoStoreState = {
  loadedFieldKeys: {} as Record<string, boolean>,
  isVaultLocked: true,
  lastActivity: 0,
  cachedEnvelope: null as import('@/shared/types/api.types').CachedVaultEnvelope | null,
  markKeysLoaded: mockMarkKeysLoaded,
  lockVault: mockLockVault,
  clearVault: mockClearVault,
  setCachedEnvelope: mockSetEnvelope,
  updateActivity: vi.fn(),
}

// Mocks for modules used by the key vault service
vi.mock('@/shared/crypto/keys/master-key', () => ({
  unwrapMasterKeyWithPassword: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x03)),
}))

vi.mock('@/shared/crypto/keys/split-kdf', () => ({
  derivePasswordKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x04)),
}))

vi.mock('@/shared/crypto/core/crypto-utils', async () => ({
  ...(await vi.importActual('@/shared/crypto/core/crypto-utils')),
  zeroFill: vi.fn(),
}))

vi.mock('@/shared/crypto/core/aes-gcm', () => ({
  importKey: vi.fn().mockResolvedValue({} as CryptoKey),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}))

vi.mock('@/shared/crypto/keys/field-keys', () => ({
  unwrapFieldKeys: vi.fn().mockResolvedValue(
    new Map<string, CryptoKey>([
      ['note', {} as CryptoKey],
      ['website', {} as CryptoKey],
      ['email', {} as CryptoKey],
    ]),
  ),
}))

vi.mock('@/shared/crypto/core/hkdf', () => ({
  deriveKEK: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x08)),
}))

vi.mock('@/shared/api/supabase-keys', () => ({
  fetchFreshEnvelope: vi.fn().mockResolvedValue({ ...mockEnvelopeData, fieldKeys: mockFieldKeysData }),
  fetchFieldKeys: vi.fn().mockResolvedValue(mockFieldKeysData),
}))

vi.mock('@/shared/crypto/vault/crypto-store', () => ({
  useCryptoStore: {
    getState: vi.fn(() => cryptoStoreState),
    setState: vi.fn(),
  },
}))

// Existing tests for the KeyVault data structure
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

    keyVault.storeKey('kek', kek)
    keyVault.storeFieldKeys(fieldKeys)

    expect(keyVault.getKey('kek')).toBe(kek)
    expect(keyVault.getKey('note')).toBe(noteKey)
    expect(keyVault.getKey('website')).toBe(websiteKey)
    expect(keyVault.getKey('email')).toBe(emailKey)
    expect(mockMarkKeysLoaded).toHaveBeenCalledWith(['note', 'website', 'email'])
  })
})

describe('unlockVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    keyVault.zeroKeys()
    cryptoStoreState.isVaultLocked = true
    cryptoStoreState.cachedEnvelope = null
    keyVault.zeroKeys()
  })

  it('fetches vault envelope after authentication', async () => {
    await keyVault.unlockVault('1', 'testpass123')

    expect(fetchFreshEnvelope).toHaveBeenCalledWith('1')
  })

  it('derives KEK from password and envelope, then stores field keys', async () => {
    await keyVault.unlockVault('1', 'testpass123')

    expect(derivePasswordKey).toHaveBeenCalledWith('testpass123', expect.any(String))
    expect(unwrapMasterKeyWithPassword).toHaveBeenCalledWith(expect.any(Uint8Array), expect.any(Object))
    expect(deriveKEK).toHaveBeenCalled()
    expect(unwrapFieldKeys).toHaveBeenCalledWith(mockFieldKeysData, expect.any(Object))
    expect(mockMarkKeysLoaded).toHaveBeenCalledWith(['note', 'website', 'email'])
  })

  it('caches envelope data after login', async () => {
    await keyVault.unlockVault('1', 'testpass123')

    expect(mockSetEnvelope).toHaveBeenCalledWith({
      ...mockEnvelopeData,
      fieldKeys: mockFieldKeysData,
    })
  })

  it('uses cached envelope when available instead of fetching from server', async () => {
    const cachedEnvelope = {
      kdfSalt: 'aa'.repeat(16),
      wrappedMasterKey: 'cc'.repeat(48),
      masterKeyIV: 'dd'.repeat(12),
      fieldKeys: mockFieldKeysData,
    }
    cryptoStoreState.cachedEnvelope = cachedEnvelope

    await keyVault.unlockVault('1', 'testpass123')

    expect(fetchFreshEnvelope).not.toHaveBeenCalled()
    expect(mockSetEnvelope).not.toHaveBeenCalled()
    expect(unwrapMasterKeyWithPassword).toHaveBeenCalled()
    expect(mockMarkKeysLoaded).toHaveBeenCalled()
  })

  it('does not call setCachedEnvelope when envelope is already cached', async () => {
    const cachedEnvelope = {
      kdfSalt: 'aa'.repeat(16),
      wrappedMasterKey: 'cc'.repeat(48),
      masterKeyIV: 'dd'.repeat(12),
      fieldKeys: mockFieldKeysData,
    }
    cryptoStoreState.cachedEnvelope = cachedEnvelope
    await keyVault.unlockVault('1', 'testpass123')
    expect(mockSetEnvelope).not.toHaveBeenCalled()
  })

  it('clears cache and retries from server on DecryptionError', async () => {
    const storeFieldKeysSpy = vi.spyOn(keyVault, 'storeFieldKeys')
    const cachedEnvelope = {
      kdfSalt: 'aa'.repeat(16),
      wrappedMasterKey: 'cc'.repeat(48),
      masterKeyIV: 'dd'.repeat(12),
      fieldKeys: mockFieldKeysData,
    }
    cryptoStoreState.cachedEnvelope = cachedEnvelope
    vi.mocked(unwrapMasterKeyWithPassword).mockRejectedValueOnce(new DecryptionError())
    await keyVault.unlockVault('1', 'testpass123')
    expect(mockClearVault).toHaveBeenCalled()
    expect(fetchFreshEnvelope).toHaveBeenCalledWith('1')
    expect(mockSetEnvelope).toHaveBeenCalled()
    expect(storeFieldKeysSpy).toHaveBeenCalled()
  })

  it('re-throws if retry also fails', async () => {
    const cachedEnvelope = {
      kdfSalt: 'aa'.repeat(16),
      wrappedMasterKey: 'cc'.repeat(48),
      masterKeyIV: 'dd'.repeat(12),
      fieldKeys: mockFieldKeysData,
    }
    cryptoStoreState.cachedEnvelope = cachedEnvelope
    vi.mocked(unwrapMasterKeyWithPassword).mockRejectedValue(new DecryptionError())
    await expect(keyVault.unlockVault('1', 'testpass123')).rejects.toThrow(DecryptionError)
    expect(mockClearVault).toHaveBeenCalled()
    expect(fetchFreshEnvelope).toHaveBeenCalled()
  })

  it('does not retry on non-DecryptionError', async () => {
    const cachedEnvelope = {
      kdfSalt: 'aa'.repeat(16),
      wrappedMasterKey: 'cc'.repeat(48),
      masterKeyIV: 'dd'.repeat(12),
      fieldKeys: mockFieldKeysData,
    }
    cryptoStoreState.cachedEnvelope = cachedEnvelope
    vi.mocked(unwrapMasterKeyWithPassword).mockRejectedValueOnce(new Error('Some other error'))
    await expect(keyVault.unlockVault('1', 'testpass123')).rejects.toThrow('Some other error')
    expect(mockClearVault).not.toHaveBeenCalled()
    expect(fetchFreshEnvelope).not.toHaveBeenCalled()
  })
})

describe('syncFieldKeys', () => {
  const FAKE_KEK = {} as CryptoKey
  const FIELD_KEYS_RESPONSE: ServerFieldKey[] = [
    { fieldName: 'note', version: 2, wrappedFieldKey: 'new-wrapped-note-key', fieldKeyIV: 'new-note-iv' },
    { fieldName: 'title', version: 1, wrappedFieldKey: 'wrapped-title-key', fieldKeyIV: 'title-iv' },
  ]

  const cachedEnvelope = {
    kdfSalt: 'aabb',
    wrappedMasterKey: 'eeff',
    masterKeyIV: '1122',
    fieldKeys: [{ fieldName: 'note', version: 1, wrappedFieldKey: 'old-note-key', fieldKeyIV: 'note-iv' }],
  }

  function makeUnwrappedKeys(names: FieldName[]): Map<string, CryptoKey> {
    const map = new Map<string, CryptoKey>()
    for (const name of names) {
      map.set(name, {} as CryptoKey)
    }
    return map
  }

  beforeEach(() => {
    vi.clearAllMocks()
    keyVault.zeroKeys()

    // Default: KEK available, happy path
    keyVault.storeKey('kek', FAKE_KEK)
    vi.mocked(fetchFieldKeys).mockResolvedValue(FIELD_KEYS_RESPONSE)
    vi.mocked(unwrapFieldKeys).mockResolvedValue(makeUnwrappedKeys(['note', 'title']))

    cryptoStoreState.cachedEnvelope = cachedEnvelope
  })

  it('fetches field keys, unwraps, stores in vault, updates envelope', async () => {
    await keyVault.syncFieldKeys('user-1')

    expect(fetchFieldKeys).toHaveBeenCalledWith('user-1')
    expect(unwrapFieldKeys).toHaveBeenCalledWith(FIELD_KEYS_RESPONSE, FAKE_KEK)
    expect(mockMarkKeysLoaded).toHaveBeenCalledWith(['note', 'title'])
    expect(mockSetEnvelope).toHaveBeenCalledWith({
      ...cachedEnvelope,
      fieldKeys: FIELD_KEYS_RESPONSE,
    })
  })

  it('throws when KEK is not in vault (vault locked)', async () => {
    keyVault.zeroKeys()

    await expect(keyVault.syncFieldKeys('user-1')).rejects.toThrow('Cannot refresh field keys')
    expect(fetchFieldKeys).not.toHaveBeenCalled()
  })

  it('throws when fetchFieldKeys throws a network error', async () => {
    vi.mocked(fetchFieldKeys).mockRejectedValueOnce(new Error('Network error'))

    await expect(keyVault.syncFieldKeys('user-1')).rejects.toThrow('Network error')
    expect(mockMarkKeysLoaded).not.toHaveBeenCalled()
  })

  it('throws when unwrapFieldKeys throws DecryptionError (stale KEK)', async () => {
    vi.mocked(unwrapFieldKeys).mockRejectedValueOnce(new DecryptionError())

    await expect(keyVault.syncFieldKeys('user-1')).rejects.toThrow(DecryptionError)
    expect(mockMarkKeysLoaded).not.toHaveBeenCalled()
  })

  it('throws when unwrapFieldKeys throws a generic error', async () => {
    vi.mocked(unwrapFieldKeys).mockRejectedValueOnce(new Error('unexpected'))

    await expect(keyVault.syncFieldKeys('user-1')).rejects.toThrow('unexpected')
  })

  it('succeeds when cachedEnvelope is null (envelope not cached)', async () => {
    cryptoStoreState.cachedEnvelope = null

    await keyVault.syncFieldKeys('user-1')

    expect(mockSetEnvelope).not.toHaveBeenCalled()
    expect(mockMarkKeysLoaded).toHaveBeenCalled()
  })

  it('calls clearVault on DecryptionError', async () => {
    const clearVaultSpy = vi.spyOn(keyVault, 'clearVault')
    vi.mocked(unwrapFieldKeys).mockRejectedValueOnce(new DecryptionError())

    await expect(keyVault.syncFieldKeys('user-1')).rejects.toThrow(DecryptionError)
    expect(clearVaultSpy).toHaveBeenCalled()
  })

  it('does not call clearVault on network error', async () => {
    const clearVaultSpy = vi.spyOn(keyVault, 'clearVault')
    vi.mocked(fetchFieldKeys).mockRejectedValueOnce(new Error('boom'))

    await expect(keyVault.syncFieldKeys('user-1')).rejects.toThrow('boom')
    expect(clearVaultSpy).not.toHaveBeenCalled()
  })
})
