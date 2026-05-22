import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'

// Mock Supabase client
const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}))

import { getLoginSalts, getMasterKeyEnvelope, getFieldKeys } from '@/shared/api/supabase-keys'

describe('getLoginSalts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls RPC with correct username and returns salts', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ auth_salt: 'a1b2c3d4'.repeat(4), key_salt: 'e5f6g7h8'.repeat(4) }],
      error: null,
    })

    const result = await getLoginSalts('testuser')

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

    await expect(getLoginSalts('testuser')).rejects.toThrow()
  })

  it('throws INVALID_CREDENTIALS when no data returned', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    })

    try {
      await getLoginSalts('nonexistent')
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
      await getLoginSalts('nonexistent')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).code).toBe(AuthErrorCode.INVALID_CREDENTIALS)
    }
  })

  it('throws without calling RPC when username format is invalid', async () => {
    await expect(getLoginSalts('ab')).rejects.toThrow(AuthError)
    await expect(getLoginSalts('user@name')).rejects.toThrow(AuthError)
    await expect(getLoginSalts('')).rejects.toThrow(AuthError)

    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('accepts uppercase usernames and calls RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ auth_salt: 'a1b2c3d4'.repeat(4), key_salt: 'e5f6g7h8'.repeat(4) }],
      error: null,
    })

    await getLoginSalts('TestUser')

    expect(mockRpc).toHaveBeenCalledWith('get_login_salts', { p_username: 'TestUser' })
  })
})

describe('getMasterKeyEnvelope', () => {
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

    const result = await getMasterKeyEnvelope('user-1')

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

  it('throws when query returns error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    await expect(getMasterKeyEnvelope('user-1')).rejects.toThrow()
  })

  it('throws KEYS_NOT_FOUND when no data found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    try {
      await getMasterKeyEnvelope('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).code).toBe(AuthErrorCode.KEYS_NOT_FOUND)
    }
  })
})

describe('getFieldKeys', () => {
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

    const result = await getFieldKeys('user-1')

    expect(mockFrom).toHaveBeenCalledWith('field_keys')
    expect(mockSelect).toHaveBeenCalledWith('field_name, version, wrapped_key, key_iv')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toEqual([
      { fieldName: 'note', version: 1, wrappedKey: 'aa'.repeat(48), keyIV: 'bb'.repeat(12) },
      { fieldName: 'website', version: 1, wrappedKey: 'cc'.repeat(48), keyIV: 'dd'.repeat(12) },
      { fieldName: 'email', version: 1, wrappedKey: 'ee'.repeat(48), keyIV: 'ff'.repeat(12) },
    ])
  })

  it('returns empty array when no data', async () => {
    mockEq.mockResolvedValueOnce({
      data: [],
      error: null,
    })

    const result = await getFieldKeys('user-1')
    expect(result).toEqual([])
  })

  it('throws KEYS_NOT_FOUND when data is null', async () => {
    mockEq.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    try {
      await getFieldKeys('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).code).toBe(AuthErrorCode.KEYS_NOT_FOUND)
    }
  })

  it('throws when query returns error', async () => {
    mockEq.mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    await expect(getFieldKeys('user-1')).rejects.toThrow()
  })
})
