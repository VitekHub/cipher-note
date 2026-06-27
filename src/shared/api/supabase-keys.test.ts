import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import {
  LOGIN_SALTS_TABLE,
  MASTER_KEYS_TABLE,
  FIELD_KEYS_TABLE,
  GET_LOGIN_SALTS_RPC,
} from '@/shared/types/supabase-schema'

// Mock Supabase client
const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
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
      data: [{ auth_hash_salt: 'a1b2c3d4'.repeat(4), password_key_salt: 'e5f6g7h8'.repeat(4) }],
      error: null,
    })

    const result = await fetchLoginSalts('testuser')

    expect(mockRpc).toHaveBeenCalledWith(GET_LOGIN_SALTS_RPC, { p_username: 'testuser' })
    expect(result).toEqual({
      authHashSalt: 'a1b2c3d4'.repeat(4),
      passwordKeySalt: 'e5f6g7h8'.repeat(4),
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
      data: [{ auth_hash_salt: 'a1b2c3d4'.repeat(4), password_key_salt: 'e5f6g7h8'.repeat(4) }],
      error: null,
    })

    await fetchLoginSalts('TestUser')

    expect(mockRpc).toHaveBeenCalledWith(GET_LOGIN_SALTS_RPC, { p_username: 'TestUser' })
  })
})

describe('fetchMasterKeyEnvelope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries login_salts and master_keys tables and maps snake_case to camelCase', async () => {
    const saltsSingle = vi.fn().mockResolvedValueOnce({
      data: {
        auth_hash_salt: 'a1b2c3d4'.repeat(4),
        password_key_salt: 'e5f6g7h8'.repeat(4),
      },
      error: null,
    })
    const masterSingle = vi.fn().mockResolvedValueOnce({
      data: {
        wrapped_master_key: 'aa'.repeat(48),
        master_key_iv: 'bb'.repeat(12),
      },
      error: null,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === LOGIN_SALTS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: saltsSingle }) }) }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: masterSingle }) }) }
    })

    const result = await fetchMasterKeyEnvelope('user-1')

    expect(mockFrom).toHaveBeenCalledWith(LOGIN_SALTS_TABLE)
    expect(mockFrom).toHaveBeenCalledWith(MASTER_KEYS_TABLE)
    expect(result).toEqual({
      authHashSalt: 'a1b2c3d4'.repeat(4),
      passwordKeySalt: 'e5f6g7h8'.repeat(4),
      wrappedMasterKey: 'aa'.repeat(48),
      masterKeyIV: 'bb'.repeat(12),
    })
  })

  it('throws ApiError on salts query error', async () => {
    const saltsSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === LOGIN_SALTS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: saltsSingle }) }) }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn() }) }) }
    })

    try {
      await fetchMasterKeyEnvelope('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })

  it('throws ApiError on master_keys query error', async () => {
    const saltsSingle = vi.fn().mockResolvedValueOnce({
      data: {
        auth_hash_salt: 'a1b2c3d4'.repeat(4),
        password_key_salt: 'e5f6g7h8'.repeat(4),
      },
      error: null,
    })
    const masterSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === LOGIN_SALTS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: saltsSingle }) }) }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: masterSingle }) }) }
    })

    try {
      await fetchMasterKeyEnvelope('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })

  it('throws NOT_FOUND when no salts data found', async () => {
    const saltsSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: null,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === LOGIN_SALTS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: saltsSingle }) }) }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn() }) }) }
    })

    try {
      await fetchMasterKeyEnvelope('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.NOT_FOUND)
    }
  })

  it('throws NOT_FOUND when no master_keys data found', async () => {
    const saltsSingle = vi.fn().mockResolvedValueOnce({
      data: {
        auth_hash_salt: 'a1b2c3d4'.repeat(4),
        password_key_salt: 'e5f6g7h8'.repeat(4),
      },
      error: null,
    })
    const masterSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: null,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === LOGIN_SALTS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: saltsSingle }) }) }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: masterSingle }) }) }
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

    // Chain: from(FIELD_KEYS_TABLE).select(...).eq(...)
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq,
      }),
    })
  })

  it('queries field_keys table and maps to ServerFieldKey format', async () => {
    mockEq.mockResolvedValueOnce({
      data: [
        { field_name: 'note', version: 1, wrapped_field_key: 'aa'.repeat(48), field_key_iv: 'bb'.repeat(12) },
        { field_name: 'website', version: 1, wrapped_field_key: 'cc'.repeat(48), field_key_iv: 'dd'.repeat(12) },
        { field_name: 'email', version: 1, wrapped_field_key: 'ee'.repeat(48), field_key_iv: 'ff'.repeat(12) },
      ],
      error: null,
    })

    const result = await fetchFieldKeys('user-1')

    expect(mockFrom).toHaveBeenCalledWith(FIELD_KEYS_TABLE)
    expect(mockSelect).toHaveBeenCalledWith('field_name, version, wrapped_field_key, field_key_iv')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toEqual([
      { fieldName: 'note', version: 1, wrappedFieldKey: 'aa'.repeat(48), fieldKeyIV: 'bb'.repeat(12) },
      { fieldName: 'website', version: 1, wrappedFieldKey: 'cc'.repeat(48), fieldKeyIV: 'dd'.repeat(12) },
      { fieldName: 'email', version: 1, wrappedFieldKey: 'ee'.repeat(48), fieldKeyIV: 'ff'.repeat(12) },
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
    // Mock three sequential queries: login_salts, master_keys, field_keys
    const saltsSingle = vi.fn().mockResolvedValueOnce({
      data: {
        auth_hash_salt: 'a1b2c3d4'.repeat(4),
        password_key_salt: 'e5f6g7h8'.repeat(4),
      },
      error: null,
    })
    const masterSingle = vi.fn().mockResolvedValueOnce({
      data: {
        wrapped_master_key: 'aa'.repeat(48),
        master_key_iv: 'bb'.repeat(12),
      },
      error: null,
    })
    const fieldKeysEq = vi.fn().mockResolvedValue({
      data: [
        { field_name: 'note', version: 1, wrapped_field_key: 'cc'.repeat(48), field_key_iv: 'dd'.repeat(12) },
        { field_name: 'title', version: 1, wrapped_field_key: 'ee'.repeat(48), field_key_iv: 'ff'.repeat(12) },
      ],
      error: null,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === LOGIN_SALTS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: saltsSingle }) }) }
      }
      if (table === MASTER_KEYS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: masterSingle }) }) }
      }
      return { select: vi.fn().mockReturnValue({ eq: fieldKeysEq }) }
    })

    const result = await fetchFreshEnvelope('user-1')

    expect(result).toEqual({
      authHashSalt: 'a1b2c3d4'.repeat(4),
      passwordKeySalt: 'e5f6g7h8'.repeat(4),
      wrappedMasterKey: 'aa'.repeat(48),
      masterKeyIV: 'bb'.repeat(12),
      fieldKeys: [
        { fieldName: 'note', version: 1, wrappedFieldKey: 'cc'.repeat(48), fieldKeyIV: 'dd'.repeat(12) },
        { fieldName: 'title', version: 1, wrappedFieldKey: 'ee'.repeat(48), fieldKeyIV: 'ff'.repeat(12) },
      ],
    })
  })

  it('propagates errors from fetchMasterKeyEnvelope', async () => {
    const saltsSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === LOGIN_SALTS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: saltsSingle }) }) }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn() }) }) }
    })

    try {
      await fetchFreshEnvelope('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
    }
  })

  it('propagates errors from fetchFieldKeys', async () => {
    const saltsSingle = vi.fn().mockResolvedValueOnce({
      data: {
        auth_hash_salt: 'a1b2c3d4'.repeat(4),
        password_key_salt: 'e5f6g7h8'.repeat(4),
      },
      error: null,
    })
    const masterSingle = vi.fn().mockResolvedValueOnce({
      data: {
        wrapped_master_key: 'aa'.repeat(48),
        master_key_iv: 'bb'.repeat(12),
      },
      error: null,
    })
    const fieldKeysEq = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Query error' },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === LOGIN_SALTS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: saltsSingle }) }) }
      }
      if (table === MASTER_KEYS_TABLE) {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: masterSingle }) }) }
      }
      return { select: vi.fn().mockReturnValue({ eq: fieldKeysEq }) }
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
      wrappedFieldKey: 'aa'.repeat(48),
      fieldKeyIV: 'bb'.repeat(12),
    })

    expect(mockFrom).toHaveBeenCalledWith(FIELD_KEYS_TABLE)
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        field_name: 'note',
        version: 1,
        wrapped_field_key: 'aa'.repeat(48),
        field_key_iv: 'bb'.repeat(12),
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
        wrappedFieldKey: 'aa'.repeat(48),
        fieldKeyIV: 'bb'.repeat(12),
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

  it('updates login_salts and master_keys tables with correct data', async () => {
    mockEq.mockResolvedValueOnce({ data: null, error: null })
    mockEq.mockResolvedValueOnce({ data: null, error: null })

    await updateMasterKeyEnvelope('user-1', {
      authHashSalt: 'a1b2c3d4'.repeat(4),
      passwordKeySalt: 'e5f6g7h8'.repeat(4),
      wrappedMasterKey: 'aa'.repeat(48),
      masterKeyIV: 'bb'.repeat(12),
    })

    expect(mockFrom).toHaveBeenCalledWith(LOGIN_SALTS_TABLE)
    expect(mockFrom).toHaveBeenCalledWith(MASTER_KEYS_TABLE)
    expect(mockUpdate).toHaveBeenCalledWith({
      auth_hash_salt: 'a1b2c3d4'.repeat(4),
      password_key_salt: 'e5f6g7h8'.repeat(4),
    })
    expect(mockUpdate).toHaveBeenCalledWith({
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
        authHashSalt: 'a1b2c3d4'.repeat(4),
        passwordKeySalt: 'e5f6g7h8'.repeat(4),
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
