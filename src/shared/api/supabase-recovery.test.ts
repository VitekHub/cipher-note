import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { createSupabaseQueryMocks, createQueryBuilder } from '@/test/supabase-mock'

const { maybeSingle, single } = createSupabaseQueryMocks()
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
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    await fetchRecoveryData('user-1')

    expect(mockFrom).toHaveBeenCalledWith('recovery')
    expect(qb.select).toHaveBeenCalledWith('recovery_salt, wrapped_master_key, recovery_iv')
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
  let qb: ReturnType<typeof createQueryBuilder>

  beforeEach(() => {
    vi.clearAllMocks()
    qb = createQueryBuilder({ maybeSingle, single })
    mockFrom.mockReturnValue(qb)
  })

  it('calls upsert with correct data and onConflict', async () => {
    // saveRecoveryData uses upsert() without .select().single(),
    // but the mock builder makes upsert() return qb for chaining.
    // The await on the upsert result is handled by making the
    // entire chain thenable. For simplicity, we mock single to resolve.
    // Since saveRecoveryData destructures { error } from the result,
    // we need upsert to return a thenable that resolves with { error: null }.
    // The easiest way: make upsert return a thenable object that also has select().
    const upsertResult = { data: null, error: null }
    qb.upsert = vi.fn().mockReturnValue({
      // Make the upsert result thenable so `await upsert(...)` works
      then: (resolve: (value: unknown) => void) => resolve(upsertResult),
      select: vi.fn().mockReturnValue(qb),
    })

    await saveRecoveryData('user-1', {
      recoverySalt: 'aa'.repeat(16),
      wrappedMasterKey: 'bb'.repeat(48),
      recoveryIV: 'cc'.repeat(12),
    })

    expect(mockFrom).toHaveBeenCalledWith('recovery')
    expect(qb.upsert).toHaveBeenCalledWith(
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
    const upsertResult = { data: null, error: { message: 'Upsert failed' } }
    qb.upsert = vi.fn().mockReturnValue({
      then: (resolve: (value: unknown) => void) => resolve(upsertResult),
      select: vi.fn().mockReturnValue(qb),
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
