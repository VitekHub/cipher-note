import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ServerEncryptedField, CachedVaultEnvelope } from '@/shared/types/api.types'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { GeneratedFieldKey } from '@/shared/crypto/keys/field-keys'
import type { EncryptedFieldData } from '@/shared/types/crypto.types'

const {
  mockGetKey,
  mockStoreKey,
  mockFetchAll,
  mockRotateRpc,
  mockGenerateFieldKey,
  mockDecryptField,
  mockEncryptField,
  mockMarkLocal,
  mockUpdateCachedFieldKey,
  mockEnvelope,
  mockKek,
  mockOldKey,
  mockNewKey,
} = vi.hoisted(() => ({
  mockGetKey: vi.fn<(id: string) => CryptoKey | undefined>(),
  mockStoreKey: vi.fn<(id: string, key: CryptoKey) => void>(),
  mockFetchAll: vi.fn<(userId: string, fieldName: FieldName) => Promise<ServerEncryptedField[]>>(),
  mockRotateRpc: vi.fn<(input: unknown) => Promise<void>>(),
  mockGenerateFieldKey: vi.fn<(kek: CryptoKey, fieldName: FieldName, version: number) => Promise<GeneratedFieldKey>>(),
  mockDecryptField: vi.fn<(data: EncryptedFieldData, key: CryptoKey, fieldName: FieldName) => Promise<string>>(),
  mockEncryptField: vi.fn<(plaintext: string, key: CryptoKey, fieldName: FieldName) => Promise<EncryptedFieldData>>(),
  mockMarkLocal: vi.fn<(fieldName: FieldName, version: number) => void>(),
  mockUpdateCachedFieldKey: vi.fn<(input: unknown) => void>(),
  mockEnvelope: {
    kdfSalt: 'a1b2c3d4'.repeat(4),
    wrappedMasterKey: 'aa'.repeat(48),
    masterKeyIV: 'bb'.repeat(12),
    fieldKeys: [
      { fieldName: 'title', version: 1, wrappedFieldKey: '01'.repeat(48), fieldKeyIV: '02'.repeat(12) },
      { fieldName: 'note', version: 1, wrappedFieldKey: '03'.repeat(48), fieldKeyIV: '04'.repeat(12) },
      { fieldName: 'website', version: 1, wrappedFieldKey: '05'.repeat(48), fieldKeyIV: '06'.repeat(12) },
      { fieldName: 'email', version: 1, wrappedFieldKey: '07'.repeat(48), fieldKeyIV: '08'.repeat(12) },
    ],
  } as CachedVaultEnvelope,
  mockKek: {} as CryptoKey,
  mockOldKey: {} as CryptoKey,
  mockNewKey: {} as CryptoKey,
}))

vi.mock('@/shared/crypto/vault/key-vault', () => ({
  keyVault: { getKey: mockGetKey, storeKey: mockStoreKey },
}))

vi.mock('@/shared/crypto/vault/crypto-store', () => ({
  useCryptoStore: {
    getState: () => ({
      cachedEnvelope: mockEnvelope,
      updateCachedFieldKey: mockUpdateCachedFieldKey,
    }),
  },
}))

vi.mock('@/shared/api/supabase-fields', () => ({
  fetchAllEncryptedFieldsForUser: mockFetchAll,
}))

vi.mock('@/shared/api/supabase-keys', () => ({
  rotateFieldKeyRpc: mockRotateRpc,
}))

vi.mock('@/shared/crypto/keys/field-keys', () => ({
  generateFieldKey: mockGenerateFieldKey,
}))

vi.mock('@/features/fields/model/field-crypto', () => ({
  decryptField: mockDecryptField,
  encryptField: mockEncryptField,
}))

vi.mock('@/shared/realtime/realtime-echo', () => ({
  markLocalKeyRotation: mockMarkLocal,
}))

import { rotateFieldKey, rotateAllFields } from '@/features/fields/model/key-rotation-service'

const USER_ID = 'user-1'

function twoServerFields(): ServerEncryptedField[] {
  return [
    {
      entryId: 'entry-1',
      fieldName: 'note',
      ciphertext: 'aa'.repeat(16),
      ciphertextIV: 'bb'.repeat(12),
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      entryId: 'entry-2',
      fieldName: 'note',
      ciphertext: 'cc'.repeat(16),
      ciphertextIV: 'dd'.repeat(12),
      updatedAt: '2025-01-02T00:00:00Z',
    },
  ]
}

function setupCryptoMocks() {
  mockGenerateFieldKey.mockResolvedValue({
    cryptoKey: mockNewKey,
    wrappedFieldKey: new Uint8Array(48).fill(0xff),
    fieldKeyIV: new Uint8Array(12).fill(0xee),
  })

  mockDecryptField.mockResolvedValue('decrypted')

  mockEncryptField.mockResolvedValue({
    ciphertext: new Uint8Array(16).fill(0xcc),
    ciphertextIV: new Uint8Array(12).fill(0xdd),
  })
}

describe('rotateFieldKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetKey.mockImplementation((id: string) => (id === 'kek' ? mockKek : mockOldKey))
    mockFetchAll.mockResolvedValue(twoServerFields())
    mockRotateRpc.mockResolvedValue(undefined)
    setupCryptoMocks()
  })

  it('happy path: fetches ciphertexts, rotates, calls RPC, updates vault and cache', async () => {
    await rotateFieldKey(USER_ID, 'note')

    // Inputs pulled from the vault.
    expect(mockGetKey).toHaveBeenCalledWith('kek')
    expect(mockGetKey).toHaveBeenCalledWith('note')

    // All ciphertexts for the field fetched across entries.
    expect(mockFetchAll).toHaveBeenCalledWith(USER_ID, 'note')

    // Crypto called with vault inputs + current version from the cached envelope.
    expect(mockGenerateFieldKey).toHaveBeenCalledWith(mockKek, 'note', 2)

    // Each ciphertext decrypted with the old key, then re-encrypted with the new key.
    expect(mockDecryptField).toHaveBeenCalledTimes(2)
    expect(mockEncryptField).toHaveBeenCalledTimes(2)

    // Local-echo marker set before the RPC fires.
    expect(mockMarkLocal).toHaveBeenCalledWith('note', 2)
    expect(mockMarkLocal.mock.invocationCallOrder[0]).toBeLessThan(mockRotateRpc.mock.invocationCallOrder[0]!)

    // Atomic server swap called with hex-encoded crypto results.
    expect(mockRotateRpc).toHaveBeenCalledWith({
      fieldName: 'note',
      newVersion: 2,
      newWrappedFieldKey: 'ff'.repeat(48),
      newFieldKeyIV: 'ee'.repeat(12),
      reEncryptedFields: [
        { entryId: 'entry-1', ciphertext: 'cc'.repeat(16), ciphertextIV: 'dd'.repeat(12) },
        { entryId: 'entry-2', ciphertext: 'cc'.repeat(16), ciphertextIV: 'dd'.repeat(12) },
      ],
    })

    // Local vault + cache updated with the new key.
    expect(mockStoreKey).toHaveBeenCalledWith('note', mockNewKey)
    expect(mockUpdateCachedFieldKey).toHaveBeenCalledWith({
      fieldName: 'note',
      version: 2,
      wrappedFieldKey: 'ff'.repeat(48),
      fieldKeyIV: 'ee'.repeat(12),
    })
  })

  it('throws before any network call when the vault is locked', async () => {
    mockGetKey.mockReturnValue(undefined)

    await expect(rotateFieldKey(USER_ID, 'note')).rejects.toThrow('Vault is locked — cannot rotate')

    expect(mockFetchAll).not.toHaveBeenCalled()
    expect(mockGenerateFieldKey).not.toHaveBeenCalled()
    expect(mockRotateRpc).not.toHaveBeenCalled()
    expect(mockStoreKey).not.toHaveBeenCalled()
    expect(mockUpdateCachedFieldKey).not.toHaveBeenCalled()
  })

  it('does not mutate vault or cache when the RPC fails (server rolled back)', async () => {
    mockRotateRpc.mockRejectedValueOnce(new Error('rpc failed'))

    await expect(rotateFieldKey(USER_ID, 'note')).rejects.toThrow('rpc failed')

    // Crypto ran and the marker was set, but the local state was NOT updated.
    expect(mockGenerateFieldKey).toHaveBeenCalledTimes(1)
    expect(mockRotateRpc).toHaveBeenCalledTimes(1)
    expect(mockStoreKey).not.toHaveBeenCalled()
    expect(mockUpdateCachedFieldKey).not.toHaveBeenCalled()
  })

  it('still calls the RPC with an empty re-encrypted fields list when there are no entries', async () => {
    mockFetchAll.mockResolvedValueOnce([])

    await rotateFieldKey(USER_ID, 'note')

    expect(mockDecryptField).not.toHaveBeenCalled()
    expect(mockEncryptField).not.toHaveBeenCalled()
    expect(mockRotateRpc).toHaveBeenCalledWith(expect.objectContaining({ reEncryptedFields: [] }))
    expect(mockStoreKey).toHaveBeenCalledWith('note', mockNewKey)
    expect(mockUpdateCachedFieldKey).toHaveBeenCalledTimes(1)
  })
})

describe('rotateAllFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetKey.mockImplementation((id: string) => (id === 'kek' ? mockKek : mockOldKey))
    mockFetchAll.mockResolvedValue([])
    mockRotateRpc.mockResolvedValue(undefined)
    setupCryptoMocks()
    // Reflect successful rotations in the cached envelope so currentVersionFor
    // reports the new version for subsequent rotations in the loop.
    mockUpdateCachedFieldKey.mockImplementation((input: unknown) => {
      const { fieldName, version } = input as { fieldName: FieldName; version: number }
      const others = mockEnvelope.fieldKeys.filter((k) => k.fieldName !== fieldName)
      const rotated = mockEnvelope.fieldKeys.find((k) => k.fieldName === fieldName)
      if (rotated) others.push({ ...rotated, version })
      mockEnvelope.fieldKeys = others
    })
  })

  it('rotates all four fields sequentially and surfaces a per-field outcome', async () => {
    const outcomes = await rotateAllFields(USER_ID)

    expect(outcomes).toHaveLength(4)
    expect(outcomes.every((o) => o.ok)).toBe(true)
    expect(outcomes.map((o) => o.fieldName)).toEqual(['title', 'note', 'website', 'email'])
    expect(mockRotateRpc).toHaveBeenCalledTimes(4)
    expect(mockStoreKey).toHaveBeenCalledTimes(4)
  })

  it('partial failure: 3rd field fails, first two stay rotated, 4th untouched', async () => {
    // Restore envelope versions before the run.
    mockEnvelope.fieldKeys = [
      { fieldName: 'title', version: 1, wrappedFieldKey: '01'.repeat(48), fieldKeyIV: '02'.repeat(12) },
      { fieldName: 'note', version: 1, wrappedFieldKey: '03'.repeat(48), fieldKeyIV: '04'.repeat(12) },
      { fieldName: 'website', version: 1, wrappedFieldKey: '05'.repeat(48), fieldKeyIV: '06'.repeat(12) },
      { fieldName: 'email', version: 1, wrappedFieldKey: '07'.repeat(48), fieldKeyIV: '08'.repeat(12) },
    ]
    mockRotateRpc.mockImplementation((input: unknown) => {
      const { fieldName } = input as { fieldName: FieldName }
      if (fieldName === 'website') return Promise.reject(new Error('website failed'))
      return Promise.resolve()
    })

    const outcomes = await rotateAllFields(USER_ID)

    expect(outcomes).toEqual([
      { fieldName: 'title', ok: true, newVersion: 2 },
      { fieldName: 'note', ok: true, newVersion: 2 },
      { fieldName: 'website', ok: false, error: expect.any(Error) },
      { fieldName: 'email', ok: true, newVersion: 2 },
    ])

    // RPC attempted for all four (website's rejects).
    expect(mockRotateRpc).toHaveBeenCalledTimes(4)
    // Local state updated only for the three that succeeded.
    expect(mockStoreKey).toHaveBeenCalledTimes(3)
    expect(mockStoreKey).toHaveBeenCalledWith('title', mockNewKey)
    expect(mockStoreKey).toHaveBeenCalledWith('note', mockNewKey)
    expect(mockStoreKey).toHaveBeenCalledWith('email', mockNewKey)
    expect(mockStoreKey).not.toHaveBeenCalledWith('website', mockNewKey)
  })
})
