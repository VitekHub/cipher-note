import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: vi.fn(),
}))

import { getSupabase } from '@/shared/api/supabase-client'
import { deleteAccount } from './supabase-account'

const mockRpc = vi.fn()
const mockGetSupabase = vi.mocked(getSupabase)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSupabase.mockReturnValue({ auth: {}, from: vi.fn(), rpc: mockRpc } as unknown as ReturnType<
    typeof getSupabase
  >)
})

describe('deleteAccount', () => {
  it('calls the delete_account RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await deleteAccount()

    expect(mockRpc).toHaveBeenCalledWith('delete_account')
  })

  it('returns void on success', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const result = await deleteAccount()

    expect(result).toBeUndefined()
  })

  it('throws ApiError(UNEXPECTED) when RPC returns an error', async () => {
    const rpcError = { message: 'Not authenticated', code: 'P0001', details: '' }
    mockRpc.mockResolvedValue({ data: null, error: rpcError })

    const error = await deleteAccount().catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe(ApiErrorCode.UNEXPECTED)
  })
})
