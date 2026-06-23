import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { FIELD_KEYS_TABLE } from '@/shared/types/supabase-schema'

// Mock Supabase client
const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockUpsert = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}))

import {
  fetchLoginSalts,
  fetchMasterKeyEnvelope,
  fetchFieldKeys,
  fetchFreshEnvelope,
  saveWrappedKey,
  updateMasterKeyEnvelope,
} from '@/shared/api/supabase-keys'

describe('fetchLoginSalts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls RPC with correct username and returns salts', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ auth_salt: 'a1b2c3d4'.repeat(4), key_salt: 'e5f6g7h8'.repeat(4) }],
      error: null,
    })

    const result = await fetchLoginSalts('testuser')

    expect(mockRpc).toHaveBeenCalledWith('get_login_salts', { p_username: 'testuser' })
    expect(result).toEqual({
      authSalt: 'a1b2c3d4'.repeat(4),
      keySalt: 'e5f6g7h8'.repeat(4),
    })
  })

  it('throws when RPC returns error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RPC error' },
    })

    await expect(fetchLoginSalts('testuser')).rejects.toThrow()
  })

  it('throws INVALID_CREDENTIALS when no data returned', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    })

    try {
      await fetchLoginSalts('nonexistent')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).code).toBe(AuthErrorCode.INVALID_CREDENTIALS)
    }
  })

  it('throws INVALID_CREDENTIALS when data is null', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    try {
      await fetchLoginSalts('nonexistent')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).code).toBe(AuthErrorCode.INVALID_CREDENTIALS)
    }
  })

  it('throws without calling RPC when username format is invalid', async () => {
    await expect(fetchLoginSalts('ab')).rejects.toThrow(AuthError)
    await expect(fetchLoginSalts('user@name')).rejects.toThrow(AuthError)
    await expect(fetchLoginSalts('')).rejects.toThrow(AuthError)

    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('accepts uppercase usernames and calls RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ auth_salt: 'a1b2c3d4'.repeat(4), key_salt: 'e5f6g7h8'.repeat(4) }],
      error: null,
    })

    await fetchLoginSalts('TestUser')

    expect(mockRpc).toHaveBeenCalledWith('get_login_salts', { p_username: 'TestUser' })
  })
})

describe('fetchMasterKeyEnvelope', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Chain: from('keys').select(...).eq(...).single()
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          single: mockSingle,
        }),
      }),
    })
  })

  it('queries keys table with userId and maps snake_case to camelCase', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        auth_salt: 'a1b2c3d4'.repeat(4),
        key_salt: 'e5f6g7h8'.repeat(4),
        wrapped_master_key: 'aa'.repeat(48),
        master_key_iv: 'bb'.repeat(12),
      },
      error: null,
    })

    const result = await fetchMasterKeyEnvelope('user-1')

    expect(mockFrom).toHaveBeenCalledWith('keys')
    expect(mockSelect).toHaveBeenCalledWith('auth_salt, key_salt, wrapped_master_key, master_key_iv')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toEqual({
      authSalt: 'a1b2c3d4'.repeat(4),
      keySalt: 'e5f6g7h8'.repeat(4),
      wrappedMasterKey: 'aa'.repeat(48),
      masterKeyIV: 'bb'.repeat(12),
    })
  })

  it('throws ApiError on query error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    try {
      await fetchMasterKeyEnvelope('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })

  it('throws NOT_FOUND when no data found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    try {
      await fetchMasterKeyEnvelope('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.NOT_FOUND)
    }
  })
})

describe('fetchFieldKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Chain: from('field_keys').select(...).eq(...)
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq,
      }),
    })
  })

  it('queries field_keys table and maps to ServerFieldKey format', async () => {
    mockEq.mockResolvedValueOnce({
      data: [
        { field_name: 'note', version: 1, wrapped_key: 'aa'.repeat(48), key_iv: 'bb'.repeat(12) },
        { field_name: 'website', version: 1, wrapped_key: 'cc'.repeat(48), key_iv: 'dd'.repeat(12) },
        { field_name: 'email', version: 1, wrapped_key: 'ee'.repeat(48), key_iv: 'ff'.repeat(12) },
      ],
      error: null,
    })

    const result = await fetchFieldKeys('user-1')

    expect(mockFrom).toHaveBeenCalledWith(FIELD_KEYS_TABLE)
    expect(mockSelect).toHaveBeenCalledWith('field_name, version, wrapped_key, key_iv')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toEqual([
      { fieldName: 'note', version: 1, wrappedKey: 'aa'.repeat(48), keyIV: 'bb'.repeat(12) },
      { fieldName: 'website', version: 1, wrappedKey: 'cc'.repeat(48), keyIV: 'dd'.repeat(12) },
      { fieldName: 'email', version: 1, wrappedKey: 'ee'.repeat(48), keyIV: 'ff'.repeat(12) },
    ])
  })

  it('throws NOT_FOUND when data is empty array', async () => {
    mockEq.mockResolvedValueOnce({
      data: [],
      error: null,
    })

    try {
      await fetchFieldKeys('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.NOT_FOUND)
    }
  })

  it('throws NOT_FOUND when data is null', async () => {
    mockEq.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    try {
      await fetchFieldKeys('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.NOT_FOUND)
    }
  })

  it('throws ApiError on query error', async () => {
    mockEq.mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    try {
      await fetchFieldKeys('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})

describe('fetchFreshEnvelope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('combines master key envelope and field keys', async () => {
    // Use separate mock functions for each query chain to avoid shared state issues
    const keysSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    })
    const keysFrom = vi.fn().mockReturnValue({ select: keysSelect })

    const fieldKeysEq = vi.fn().mockResolvedValue({
      data: [
        { field_name: 'note', version: 1, wrapped_key: 'cc'.repeat(48), key_iv: 'dd'.repeat(12) },
        { field_name: 'title', version: 1, wrapped_key: 'ee'.repeat(48), key_iv: 'ff'.repeat(12) },
      ],
      error: null,
    })
    const fieldKeysSelect = vi.fn().mockReturnValue({ eq: fieldKeysEq })
    const fieldKeysFrom = vi.fn().mockReturnValue({ select: fieldKeysSelect })

    mockSingle.mockResolvedValueOnce({
      data: {
        auth_salt: 'a1b2c3d4'.repeat(4),
        key_salt: 'e5f6g7h8'.repeat(4),
        wrapped_master_key: 'aa'.repeat(48),
        master_key_iv: 'bb'.repeat(12),
      },
      error: null,
    })

    // First call returns keys chain, second returns field_keys chain
    mockFrom.mockImplementation((table: string) => {
      if (table === 'keys') return keysFrom()
      return fieldKeysFrom()
    })

    const result = await fetchFreshEnvelope('user-1')

    expect(result).toEqual({
      authSalt: 'a1b2c3d4'.repeat(4),
      keySalt: 'e5f6g7h8'.repeat(4),
      wrappedMasterKey: 'aa'.repeat(48),
      masterKeyIV: 'bb'.repeat(12),
      fieldKeys: [
        { fieldName: 'note', version: 1, wrappedKey: 'cc'.repeat(48), keyIV: 'dd'.repeat(12) },
        { fieldName: 'title', version: 1, wrappedKey: 'ee'.repeat(48), keyIV: 'ff'.repeat(12) },
      ],
    })
  })

  it('propagates errors from fetchMasterKeyEnvelope', async () => {
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          single: mockSingle,
        }),
      }),
    })

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    try {
      await fetchFreshEnvelope('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
    }
  })

  it('propagates errors from fetchFieldKeys', async () => {
    // Use separate mock functions for the keys query to avoid polluting shared mocks
    const keysSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    })

    mockSingle.mockResolvedValueOnce({
      data: {
        auth_salt: 'a1b2c3d4'.repeat(4),
        key_salt: 'e5f6g7h8'.repeat(4),
        wrapped_master_key: 'aa'.repeat(48),
        master_key_iv: 'bb'.repeat(12),
      },
      error: null,
    })

    const fieldKeysEq = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Query error' },
    })
    const fieldKeysSelect = vi.fn().mockReturnValue({ eq: fieldKeysEq })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'keys') return { select: keysSelect }
      return { select: fieldKeysSelect }
    })

    try {
      await fetchFreshEnvelope('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
    }
  })
})

describe('saveWrappedKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFrom.mockReturnValue({
      upsert: mockUpsert,
    })
  })

  it('calls upsert with correct data and onConflict', async () => {
    mockUpsert.mockResolvedValueOnce({ data: null, error: null })

    await saveWrappedKey('user-1', {
      fieldName: 'note',
      version: 1,
      wrappedKey: 'aa'.repeat(48),
      keyIV: 'bb'.repeat(12),
    })

    expect(mockFrom).toHaveBeenCalledWith(FIELD_KEYS_TABLE)
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        field_name: 'note',
        version: 1,
        wrapped_key: 'aa'.repeat(48),
        key_iv: 'bb'.repeat(12),
      },
      { onConflict: 'user_id,field_name,version' },
    )
  })

  it('throws ApiError on upsert error', async () => {
    mockUpsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Upsert failed' },
    })

    try {
      await saveWrappedKey('user-1', {
        fieldName: 'note',
        version: 1,
        wrappedKey: 'aa'.repeat(48),
        keyIV: 'bb'.repeat(12),
      })
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})

describe('updateMasterKeyEnvelope', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFrom.mockReturnValue({
      update: mockUpdate.mockReturnValue({
        eq: mockEq,
      }),
    })
  })

  it('updates keys table with correct data', async () => {
    mockEq.mockResolvedValueOnce({ data: null, error: null })

    await updateMasterKeyEnvelope('user-1', {
      authSalt: 'a1b2c3d4'.repeat(4),
      keySalt: 'e5f6g7h8'.repeat(4),
      wrappedMasterKey: 'aa'.repeat(48),
      masterKeyIV: 'bb'.repeat(12),
    })

    expect(mockFrom).toHaveBeenCalledWith('keys')
    expect(mockUpdate).toHaveBeenCalledWith({
      auth_salt: 'a1b2c3d4'.repeat(4),
      key_salt: 'e5f6g7h8'.repeat(4),
      wrapped_master_key: 'aa'.repeat(48),
      master_key_iv: 'bb'.repeat(12),
    })
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('throws ApiError on update error', async () => {
    mockEq.mockResolvedValueOnce({
      data: null,
      error: { message: 'Update failed' },
    })

    try {
      await updateMasterKeyEnvelope('user-1', {
        authSalt: 'a1b2c3d4'.repeat(4),
        keySalt: 'e5f6g7h8'.repeat(4),
        wrappedMasterKey: 'aa'.repeat(48),
        masterKeyIV: 'bb'.repeat(12),
      })
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})
