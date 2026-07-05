import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import {
  RECOVERY_KEYS_TABLE,
  GET_RECOVERY_DATA_RPC,
  RECOVER_ACCOUNT_RPC,
  SAVE_RECOVERY_DATA_RPC,
} from '@/shared/types/supabase-schema'
import { createSupabaseQueryMocks, createQueryBuilder } from '@/test/supabase-mock'

const { maybeSingle, single } = createSupabaseQueryMocks()
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}))

import {
  fetchRecoveryData,
  saveRecoveryData,
  fetchRecoveryDataPreAuth,
  recoverAccount,
} from '@/shared/api/supabase-recovery'

describe('fetchRecoveryData', () => {
  let qb: ReturnType<typeof createQueryBuilder>

  beforeEach(() => {
    vi.clearAllMocks()
    qb = createQueryBuilder({ maybeSingle, single })
    mockFrom.mockReturnValue(qb)
  })

  it('returns null when recovery data does not exist', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await fetchRecoveryData('user-1')

    expect(result).toBeNull()
  })

  it('maps snake_case row to camelCase ServerRecoveryData', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        recovery_key_salt: 'aa'.repeat(16),
        recovery_wrapped_master_key: 'bb'.repeat(48),
        recovery_key_iv: 'cc'.repeat(12),
      },
      error: null,
    })

    const result = await fetchRecoveryData('user-1')

    expect(result).toEqual({
      recoveryKeySalt: 'aa'.repeat(16),
      recoveryWrappedMasterKey: 'bb'.repeat(48),
      recoveryKeyIV: 'cc'.repeat(12),
    })
  })

  it('queries with userId filter', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    await fetchRecoveryData('user-1')

    expect(mockFrom).toHaveBeenCalledWith(RECOVERY_KEYS_TABLE)
    expect(qb.select).toHaveBeenCalledWith('recovery_key_salt, recovery_wrapped_master_key, recovery_key_iv')
    expect(qb.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('throws ApiError on Supabase query error', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    try {
      await fetchRecoveryData('user-1')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})

describe('saveRecoveryData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls RPC with correct parameters including recoveryAuthHash', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })

    await saveRecoveryData('user-1', {
      recoveryKeySalt: 'aa'.repeat(16),
      recoveryWrappedMasterKey: 'bb'.repeat(48),
      recoveryKeyIV: 'cc'.repeat(12),
      recoveryAuthHash: 'dd'.repeat(32),
    })

    expect(mockRpc).toHaveBeenCalledWith(SAVE_RECOVERY_DATA_RPC, {
      p_user_id: 'user-1',
      p_recovery_key_salt: 'aa'.repeat(16),
      p_recovery_wrapped_master_key: 'bb'.repeat(48),
      p_recovery_key_iv: 'cc'.repeat(12),
      p_recovery_auth_hash: 'dd'.repeat(32),
    })
  })

  it('throws ApiError on Supabase RPC error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'RPC failed' } })

    try {
      await saveRecoveryData('user-1', {
        recoveryKeySalt: 'aa'.repeat(16),
        recoveryWrappedMasterKey: 'bb'.repeat(48),
        recoveryKeyIV: 'cc'.repeat(12),
        recoveryAuthHash: 'dd'.repeat(32),
      })
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})

describe('fetchRecoveryDataPreAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ServerRecoveryData when RPC succeeds', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          recovery_key_salt: 'aa'.repeat(16),
          recovery_wrapped_master_key: 'bb'.repeat(48),
          recovery_key_iv: 'cc'.repeat(12),
        },
      ],
      error: null,
    })

    const result = await fetchRecoveryDataPreAuth('testuser')

    expect(result).toEqual({
      recoveryKeySalt: 'aa'.repeat(16),
      recoveryWrappedMasterKey: 'bb'.repeat(48),
      recoveryKeyIV: 'cc'.repeat(12),
    })
  })

  it('passes username correctly to RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          recovery_key_salt: 'aa'.repeat(16),
          recovery_wrapped_master_key: 'bb'.repeat(48),
          recovery_key_iv: 'cc'.repeat(12),
        },
      ],
      error: null,
    })

    await fetchRecoveryDataPreAuth('myuser')

    expect(mockRpc).toHaveBeenCalledWith(GET_RECOVERY_DATA_RPC, { p_username: 'myuser' })
  })

  it('throws ApiError(NOT_FOUND) when RPC raises P0001 (raised exception)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'User not found' },
    })

    try {
      await fetchRecoveryDataPreAuth('nonexistent')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.NOT_FOUND)
    }
  })

  it('throws ApiError(NOT_FOUND) when RPC returns "not found" in message', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'recovery data not found for user' },
    })

    try {
      await fetchRecoveryDataPreAuth('nonexistent')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.NOT_FOUND)
    }
  })

  it('throws ApiError(NOT_FOUND) when RPC returns empty data array', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    })

    try {
      await fetchRecoveryDataPreAuth('nonexistent')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.NOT_FOUND)
    }
  })

  it('throws ApiError(NOT_FOUND) when RPC returns null data', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    try {
      await fetchRecoveryDataPreAuth('nonexistent')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.NOT_FOUND)
    }
  })

  it('throws ApiError when RPC fails with other error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'XXXXX', message: 'Internal error' },
    })

    try {
      await fetchRecoveryDataPreAuth('testuser')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})

describe('recoverAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user ID when RPC succeeds', async () => {
    mockRpc.mockResolvedValueOnce({
      data: 'user-uuid-123',
      error: null,
    })

    const result = await recoverAccount('testuser', {
      recoveryAuthHash: 'a'.repeat(64),
      newAuthHash: 'b'.repeat(64),
      newKdfSalt: 'c'.repeat(32),
      newWrappedMasterKey: 'd'.repeat(96),
      newMasterKeyIV: 'e'.repeat(24),
    })

    expect(result).toBe('user-uuid-123')
  })

  it('passes all parameters correctly to RPC including recoveryAuthHash', async () => {
    mockRpc.mockResolvedValueOnce({
      data: 'user-uuid-123',
      error: null,
    })

    const data = {
      recoveryAuthHash: 'a'.repeat(64),
      newAuthHash: 'b'.repeat(64),
      newKdfSalt: 'c'.repeat(32),
      newWrappedMasterKey: 'd'.repeat(96),
      newMasterKeyIV: 'e'.repeat(24),
    }

    await recoverAccount('testuser', data)

    expect(mockRpc).toHaveBeenCalledWith(RECOVER_ACCOUNT_RPC, {
      p_username: 'testuser',
      p_recovery_auth_hash: data.recoveryAuthHash,
      p_new_auth_hash: data.newAuthHash,
      p_new_kdf_salt: data.newKdfSalt,
      p_new_wrapped_master_key: data.newWrappedMasterKey,
      p_new_master_key_iv: data.newMasterKeyIV,
    })
  })

  it('throws ApiError when RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid recovery proof' },
    })

    try {
      await recoverAccount('testuser', {
        recoveryAuthHash: 'a'.repeat(64),
        newAuthHash: 'b'.repeat(64),
        newKdfSalt: 'c'.repeat(32),
        newWrappedMasterKey: 'd'.repeat(96),
        newMasterKeyIV: 'e'.repeat(24),
      })
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})
