import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { ENCRYPTED_FIELDS_TABLE } from '@/shared/types/supabase-schema'
import { createSupabaseQueryMocks, createQueryBuilder } from '@/test/supabase-mock'

const { maybeSingle, single } = createSupabaseQueryMocks()
const mockFrom = vi.fn()

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({
    from: mockFrom,
  }),
}))

import { fetchField, saveField } from '@/shared/api/supabase-fields'

describe('fetchField', () => {
  let qb: ReturnType<typeof createQueryBuilder>

  beforeEach(() => {
    vi.clearAllMocks()
    qb = createQueryBuilder({ maybeSingle, single })
    mockFrom.mockReturnValue(qb)
  })

  it('returns null when field does not exist', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await fetchField('entry-1', 'note')

    expect(result).toBeNull()
  })

  it('maps snake_case row to camelCase ServerEncryptedField', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        entry_id: 'entry-1',
        field_name: 'note',
        ciphertext: 'aa'.repeat(16),
        ciphertext_iv: 'bb'.repeat(12),
        updated_at: '2025-01-01T00:00:00Z',
      },
      error: null,
    })

    const result = await fetchField('entry-1', 'note')

    expect(result).toEqual({
      entryId: 'entry-1',
      fieldName: 'note',
      ciphertext: 'aa'.repeat(16),
      ciphertextIV: 'bb'.repeat(12),
      updatedAt: '2025-01-01T00:00:00Z',
    })
  })

  it('queries with userId and fieldName filters', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    await fetchField('entry-1', 'website')

    expect(mockFrom).toHaveBeenCalledWith(ENCRYPTED_FIELDS_TABLE)
    expect(qb.select).toHaveBeenCalledWith('entry_id, field_name, ciphertext, ciphertext_iv, updated_at')
    expect(qb.eq).toHaveBeenCalledWith('entry_id', 'entry-1')
    expect(qb.eq).toHaveBeenCalledWith('field_name', 'website')
  })

  it('throws ApiError on Supabase query error', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Query error' },
    })

    try {
      await fetchField('user-1', 'note')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})

describe('saveField', () => {
  let qb: ReturnType<typeof createQueryBuilder>

  beforeEach(() => {
    vi.clearAllMocks()
    qb = createQueryBuilder({ maybeSingle, single })
    mockFrom.mockReturnValue(qb)
  })

  it('calls upsert with correct data and returns updatedAt', async () => {
    single.mockResolvedValueOnce({ data: { updated_at: '2026-01-01T00:00:00Z' }, error: null })

    const result = await saveField('user-1', {
      entryId: 'entry-1',
      fieldName: 'note',
      ciphertext: 'aa'.repeat(16),
      ciphertextIV: 'bb'.repeat(12),
    })

    expect(result).toBe('2026-01-01T00:00:00Z')
    expect(mockFrom).toHaveBeenCalledWith(ENCRYPTED_FIELDS_TABLE)
    expect(qb.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        entry_id: 'entry-1',
        field_name: 'note',
        ciphertext: 'aa'.repeat(16),
        ciphertext_iv: 'bb'.repeat(12),
      },
      { onConflict: 'entry_id,field_name' },
    )
    expect(qb.select).toHaveBeenCalledWith('updated_at')
  })

  it('throws ApiError on Supabase upsert error', async () => {
    single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Upsert failed' },
    })

    try {
      await saveField('user-1', {
        entryId: 'entry-1',
        fieldName: 'note',
        ciphertext: 'aa'.repeat(16),
        ciphertextIV: 'bb'.repeat(12),
      })
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
    }
  })
})
