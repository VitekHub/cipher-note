import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { createSupabaseQueryMocks, createQueryBuilder } from '@/test/supabase-mock'

const { maybeSingle: mockMaybeSingle, upsert: mockUpsert } = createSupabaseQueryMocks()
const mockFrom = vi.fn()

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}))

import { fetchRecoveryData, saveRecoveryData } from '@/shared/api/supabase-recovery'

describe('fetchRecoveryData', () => {
  let qb: ReturnType<typeof createQueryBuilder>

  beforeEach(() => {
    vi.clearAllMocks()
    qb = createQueryBuilder({ maybeSingle: mockMaybeSingle, upsert: mockUpsert })
    mockFrom.mockReturnValue(qb)
  })

  it('returns null when recovery data does not exist', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await fetchRecoveryData('user-1')

    expect(result).toBeNull()
  })

  it('maps snake_case row to camelCase ServerRecoveryData', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        recovery_salt: 'aa'.repeat(16),
        wrapped_master_key: 'bb'.repeat(48),
        recovery_iv: 'cc'.repeat(12),
      },
      error: null,
    })

    const result = await fetchRecoveryData('user-1')

    expect(result).toEqual({
      recoverySalt: 'aa'.repeat(16),
      wrappedMasterKey: 'bb'.repeat(48),
      recoveryIV: 'cc'.repeat(12),
    })
  })

  it('queries with userId filter', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    await fetchRecoveryData('user-1')

    expect(mockFrom).toHaveBeenCalledWith('recovery')
    expect(qb.select).toHaveBeenCalledWith('recovery_salt, wrapped_master_key, recovery_iv')
    expect(qb.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('throws ApiError on Supabase query error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
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
  let qb: ReturnType<typeof createQueryBuilder>

  beforeEach(() => {
    vi.clearAllMocks()
    qb = createQueryBuilder({ maybeSingle: mockMaybeSingle, upsert: mockUpsert })
    mockFrom.mockReturnValue(qb)
  })

  it('calls upsert with correct data and onConflict', async () => {
    mockUpsert.mockResolvedValueOnce({ data: null, error: null })

    await saveRecoveryData('user-1', {
      recoverySalt: 'aa'.repeat(16),
      wrappedMasterKey: 'bb'.repeat(48),
      recoveryIV: 'cc'.repeat(12),
    })

    expect(mockFrom).toHaveBeenCalledWith('recovery')
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        recovery_salt: 'aa'.repeat(16),
        wrapped_master_key: 'bb'.repeat(48),
        recovery_iv: 'cc'.repeat(12),
      },
      { onConflict: 'user_id' },
    )
  })

  it('throws ApiError on Supabase upsert error', async () => {
    mockUpsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Upsert failed' },
    })

    try {
      await saveRecoveryData('user-1', {
        recoverySalt: 'aa'.repeat(16),
        wrappedMasterKey: 'bb'.repeat(48),
        recoveryIV: 'cc'.repeat(12),
      })
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})
