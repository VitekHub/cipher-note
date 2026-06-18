import { vi } from 'vitest'

/**
 * Create mock functions for Supabase query builder terminal methods.
 * Returned mocks can be controlled per-test with `mockResolvedValueOnce`.
 */
export function createSupabaseQueryMocks() {
  return {
    maybeSingle: vi.fn(),
    single: vi.fn(),
  }
}

/**
 * Create a mock Supabase query builder for chaining `select().eq().maybeSingle()`
 * and `upsert().select().single()` calls. Terminal methods delegate to the provided mocks.
 *
 * For fetch queries: `from(table).select(...).eq(...).maybeSingle()`
 * For save queries: `from(table).upsert(...).select(...).single()`
 */
export function createQueryBuilder(terminalMocks: ReturnType<typeof createSupabaseQueryMocks>) {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {}
  qb.select = vi.fn().mockReturnValue(qb)
  qb.eq = vi.fn().mockReturnValue(qb)
  qb.maybeSingle = terminalMocks.maybeSingle
  qb.upsert = vi.fn().mockReturnValue(qb)
  qb.single = terminalMocks.single
  return qb
}
