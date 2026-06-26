import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importKey } from '@/shared/crypto/core/aes-gcm'
import { encryptField, toSaveFieldData } from '@/features/fields/model/field-crypto'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { ServerEncryptedField } from '@/shared/types/api.types'

// --- Hoisted mocks (must be declared before vi.mock factories that reference them) ---

const { mockFetchField, mockSaveField, mockFetchAllFields, mockGetKey } = vi.hoisted(() => {
  return {
    mockFetchField: vi.fn<(...args: [string, string]) => Promise<ServerEncryptedField | null>>(),
    mockSaveField: vi.fn<
      (
        userId: string,
        data: {
          entryId: string
          fieldName: FieldName
          ciphertext: string
          ciphertextIV: string
        },
      ) => Promise<string>
    >(),
    mockFetchAllFields: vi.fn<(entryId: string) => Promise<ServerEncryptedField[]>>(),
    mockGetKey: vi.fn<(id: string) => CryptoKey | undefined>(),
  }
})

vi.mock('@/shared/api/supabase-fields', () => ({
  fetchField: mockFetchField,
  saveField: mockSaveField,
  fetchAllFields: mockFetchAllFields,
}))

vi.mock('@/shared/crypto/vault/key-vault', () => ({
  keyVault: { getKey: mockGetKey },
}))

// --- Import after mocks ---

import { fieldService } from '@/features/fields/model/field-service'

async function generateTestKey(): Promise<CryptoKey> {
  return importKey(crypto.getRandomValues(new Uint8Array(32)))
}

/** Encrypt plaintext and return a ServerEncryptedField mock with proper hex-encoded data. */
async function encryptForServer(
  plaintext: string,
  fieldKey: CryptoKey,
  fieldName: FieldName,
): Promise<ServerEncryptedField> {
  const encrypted = await encryptField(plaintext, fieldKey, fieldName)
  const saveData = toSaveFieldData(encrypted, TEST_ENTRY_ID, fieldName)
  return {
    entryId: TEST_ENTRY_ID,
    fieldName,
    ciphertext: saveData.ciphertext,
    ciphertextIV: saveData.ciphertextIV,
    updatedAt: '2025-01-01T00:00:00Z',
  }
}

const TEST_USER_ID = 'user-123'
const TEST_ENTRY_ID = 'entry-123'

describe('FieldService', () => {
  let testKey: CryptoKey

  beforeEach(async () => {
    vi.clearAllMocks()
    testKey = await generateTestKey()
    mockGetKey.mockReturnValue(testKey)
  })

  describe('loadField', () => {
    it('throws when entryId is empty', async () => {
      await expect(fieldService.loadField('', 'note')).rejects.toThrow('entryId is required')
    })

    it('returns null when server returns null (field never saved)', async () => {
      mockFetchField.mockResolvedValue(null)
      const result = await fieldService.loadField(TEST_ENTRY_ID, 'note')
      expect(result).toBeNull()
      expect(mockFetchField).toHaveBeenCalledWith(TEST_ENTRY_ID, 'note')
    })

    it('decrypts and returns plaintext when server returns field data', async () => {
      const plaintext = 'Hello, world!'
      const serverField = await encryptForServer(plaintext, testKey, 'note')
      mockFetchField.mockResolvedValue(serverField)

      const result = await fieldService.loadField(TEST_ENTRY_ID, 'note')
      expect(result).toBe(plaintext)
    })

    it('throws when field key is not available (vault locked)', async () => {
      mockGetKey.mockReturnValue(undefined)
      await expect(fieldService.loadField(TEST_ENTRY_ID, 'note')).rejects.toThrow('Field key not available for "note"')
    })
  })

  describe('saveField', () => {
    it('throws when userId is empty', async () => {
      await expect(
        fieldService.saveField({ userId: '', entryId: TEST_ENTRY_ID, fieldName: 'note', plaintext: 'test' }),
      ).rejects.toThrow('userId is required')
    })

    it('throws when entryId is empty', async () => {
      await expect(
        fieldService.saveField({ userId: TEST_USER_ID, entryId: '', fieldName: 'note', plaintext: 'test' }),
      ).rejects.toThrow('entryId is required')
    })

    it('encrypts plaintext and calls saveFieldToServer with hex-encoded data', async () => {
      mockSaveField.mockResolvedValue('2026-01-01T00:00:00Z')

      await fieldService.saveField({
        userId: TEST_USER_ID,
        entryId: TEST_ENTRY_ID,
        fieldName: 'note',
        plaintext: 'My secret note',
      })

      expect(mockSaveField).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          entryId: TEST_ENTRY_ID,
          fieldName: 'note',
          ciphertext: expect.any(String),
          ciphertextIV: expect.any(String),
        }),
      )
      const saveData = mockSaveField.mock.calls[0][1]
      // Hex strings should contain only hex chars
      expect(saveData.ciphertext).toMatch(/^[0-9a-f]+$/)
      expect(saveData.ciphertextIV).toMatch(/^[0-9a-f]+$/)
    })

    it('throws when field key is not available (vault locked)', async () => {
      mockGetKey.mockReturnValue(undefined)
      await expect(
        fieldService.saveField({ userId: TEST_USER_ID, entryId: TEST_ENTRY_ID, fieldName: 'note', plaintext: 'test' }),
      ).rejects.toThrow('Field key not available for "note"')
    })
  })

  describe('loadAllFields', () => {
    it('throws when entryId is empty', async () => {
      await expect(fieldService.loadAllFields('')).rejects.toThrow('entryId is required')
    })

    it('loads all four fields and returns null for unsaved fields', async () => {
      mockFetchAllFields.mockResolvedValue([])
      const result = await fieldService.loadAllFields(TEST_ENTRY_ID)
      expect(result).toEqual({ title: null, note: null, website: null, email: null })
      expect(mockFetchAllFields).toHaveBeenCalledWith(TEST_ENTRY_ID)
    })

    it('loads all four fields with mixed data', async () => {
      const titleKey = await generateTestKey()
      const noteKey = await generateTestKey()
      const websiteKey = await generateTestKey()
      const emailKey = await generateTestKey()

      mockGetKey.mockImplementation((id: string) => {
        if (id === 'title') return titleKey
        if (id === 'note') return noteKey
        if (id === 'website') return websiteKey
        if (id === 'email') return emailKey
        return undefined
      })

      const titleServerField = await encryptForServer('My Title', titleKey, 'title')
      const noteServerField = await encryptForServer('My note', noteKey, 'note')
      const websiteServerField = await encryptForServer('https://example.com', websiteKey, 'website')

      mockFetchAllFields.mockResolvedValue([titleServerField, noteServerField, websiteServerField])

      const result = await fieldService.loadAllFields(TEST_ENTRY_ID)
      expect(result.title).toBe('My Title')
      expect(result.note).toBe('My note')
      expect(result.website).toBe('https://example.com')
      expect(result.email).toBeNull()
    })

    it('throws when a field key is unavailable', async () => {
      const titleKey = await generateTestKey()

      mockGetKey.mockImplementation((id: string) => {
        if (id === 'title') return titleKey
        return undefined // other keys unavailable
      })

      const titleServerField = await encryptForServer('My Title', titleKey, 'title')
      const noteServerField = await encryptForServer('My note', titleKey, 'note') // mismatch key for note

      mockFetchAllFields.mockResolvedValue([titleServerField, noteServerField])

      await expect(fieldService.loadAllFields(TEST_ENTRY_ID)).rejects.toThrow()
    })
  })
})
