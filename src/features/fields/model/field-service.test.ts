import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importKey } from '@/shared/crypto/aes-gcm'
import { encryptField, toSaveFieldData } from '@/features/fields/model/field-crypto'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { ServerEncryptedField, SaveFieldData } from '@/shared/types/api.types'

// --- Hoisted mocks (must be declared before vi.mock factories that reference them) ---

const { mockFetchField, mockSaveField, mockGetKey, mockUser, mockGetAuthState } = vi.hoisted(() => {
  const mockUser = { id: 'user-123', username: 'testuser', createdAt: '2025-01-01T00:00:00Z' }
  const mockGetAuthState = vi.fn(() => ({
    user: mockUser,
    session: { accessToken: 'test-token', expiresAt: Date.now() + 3600000 },
    isLoading: false,
    isRestoringSession: false,
    setLoading: vi.fn(),
    setAuth: vi.fn(),
    setRestoringSession: vi.fn(),
    reset: vi.fn(),
    setUser: vi.fn(),
    setSession: vi.fn(),
  }))

  return {
    mockFetchField: vi.fn<(...args: [string, string]) => Promise<ServerEncryptedField | null>>(),
    mockSaveField: vi.fn<(userId: string, fieldName: string, data: SaveFieldData) => Promise<void>>(),
    mockGetKey: vi.fn<(id: string) => CryptoKey | undefined>(),
    mockUser,
    mockGetAuthState,
  }
})

vi.mock('@/shared/api/supabase-fields', () => ({
  fetchField: mockFetchField,
  saveField: mockSaveField,
}))

vi.mock('@/features/encryption/model/key-vault', () => ({
  keyVault: { getKey: mockGetKey },
}))

vi.mock('@/features/auth/model/auth-store', () => ({
  useAuthStore: {
    getState: mockGetAuthState,
    setState: vi.fn(),
  },
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
  const saveData = toSaveFieldData(encrypted)
  return {
    fieldName,
    encryptedBlob: saveData.encryptedBlob,
    iv: saveData.iv,
    updatedAt: '2025-01-01T00:00:00Z',
  }
}

describe('FieldService', () => {
  let testKey: CryptoKey

  beforeEach(async () => {
    vi.clearAllMocks()
    // Restore the default auth state after clearAllMocks
    mockGetAuthState.mockReturnValue({
      user: mockUser,
      session: { accessToken: 'test-token', expiresAt: Date.now() + 3600000 },
      isLoading: false,
      isRestoringSession: false,
      setLoading: vi.fn(),
      setAuth: vi.fn(),
      setRestoringSession: vi.fn(),
      reset: vi.fn(),
      setUser: vi.fn(),
      setSession: vi.fn(),
    })
    testKey = await generateTestKey()
    mockGetKey.mockReturnValue(testKey)
  })

  describe('loadField', () => {
    it('returns null when server returns null (field never saved)', async () => {
      mockFetchField.mockResolvedValue(null)
      const result = await fieldService.loadField('note')
      expect(result).toBeNull()
      expect(mockFetchField).toHaveBeenCalledWith('user-123', 'note')
    })

    it('decrypts and returns plaintext when server returns field data', async () => {
      const plaintext = 'Hello, world!'
      const serverField = await encryptForServer(plaintext, testKey, 'note')
      mockFetchField.mockResolvedValue(serverField)

      const result = await fieldService.loadField('note')
      expect(result).toBe(plaintext)
    })

    it('throws when field key is not available (vault locked)', async () => {
      mockGetKey.mockReturnValue(undefined)
      await expect(fieldService.loadField('note')).rejects.toThrow('Field key not available for "note"')
    })

    it('throws when user is not authenticated', async () => {
      mockGetAuthState.mockReturnValue({
        user: null as unknown as typeof mockUser,
        session: null as unknown as { accessToken: string; expiresAt: number },
        isLoading: false,
        isRestoringSession: false,
        setLoading: vi.fn(),
        setAuth: vi.fn(),
        setRestoringSession: vi.fn(),
        reset: vi.fn(),
        setUser: vi.fn(),
        setSession: vi.fn(),
      })

      await expect(fieldService.loadField('note')).rejects.toThrow('Not authenticated')
    })
  })

  describe('saveField', () => {
    it('encrypts plaintext and calls saveFieldToServer with hex-encoded data', async () => {
      mockSaveField.mockResolvedValue(undefined)

      await fieldService.saveField('note', 'My secret note')

      expect(mockSaveField).toHaveBeenCalledWith(
        'user-123',
        'note',
        expect.objectContaining({
          encryptedBlob: expect.any(String),
          iv: expect.any(String),
        }),
      )
      const saveData = mockSaveField.mock.calls[0][2]
      // Hex strings should contain only hex chars
      expect(saveData.encryptedBlob).toMatch(/^[0-9a-f]+$/)
      expect(saveData.iv).toMatch(/^[0-9a-f]+$/)
    })

    it('throws when field key is not available (vault locked)', async () => {
      mockGetKey.mockReturnValue(undefined)
      await expect(fieldService.saveField('note', 'test')).rejects.toThrow('Field key not available for "note"')
    })
  })

  describe('loadAllFields', () => {
    it('loads all three fields in parallel and returns null for unsaved fields', async () => {
      mockFetchField.mockResolvedValue(null)
      const result = await fieldService.loadAllFields()
      expect(result).toEqual({ note: null, website: null, email: null })
      expect(mockFetchField).toHaveBeenCalledTimes(3)
    })

    it('loads all three fields with mixed data', async () => {
      const noteKey = await generateTestKey()
      const websiteKey = await generateTestKey()
      const emailKey = await generateTestKey()

      mockGetKey.mockImplementation((id: string) => {
        if (id === 'note') return noteKey
        if (id === 'website') return websiteKey
        if (id === 'email') return emailKey
        return undefined
      })

      const noteServerField = await encryptForServer('My note', noteKey, 'note')
      const websiteServerField = await encryptForServer('https://example.com', websiteKey, 'website')

      mockFetchField.mockImplementation(async (_userId: string, fieldName: string) => {
        if (fieldName === 'note') return noteServerField
        if (fieldName === 'website') return websiteServerField
        return null // email never saved
      })

      const result = await fieldService.loadAllFields()
      expect(result.note).toBe('My note')
      expect(result.website).toBe('https://example.com')
      expect(result.email).toBeNull()
    })
  })
})
