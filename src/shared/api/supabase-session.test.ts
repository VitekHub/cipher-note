import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GET_ACTIVE_SESSIONS_RPC,
  REVOKE_SESSION_RPC,
  REVOKE_OTHER_SESSIONS_RPC,
  IS_SESSION_VALID_RPC,
} from '@/shared/types/supabase-schema'

const mockRpc = vi.fn()

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({ rpc: mockRpc }),
}))

// Import after mock setup
import { getActiveSessions, revokeSession, revokeOtherSessions, isSessionValid } from '@/shared/api/supabase-session'

describe('supabase-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getActiveSessions', () => {
    it('calls the correct RPC and returns data', async () => {
      const sessions = [
        {
          id: 'session-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-02',
          user_agent: 'Chrome',
          ip: '1.2.3.4',
          not_after: null,
        },
      ]
      mockRpc.mockResolvedValue({ data: sessions, error: null })

      const result = await getActiveSessions()

      expect(mockRpc).toHaveBeenCalledWith(GET_ACTIVE_SESSIONS_RPC)
      expect(result).toEqual(sessions)
    })

    it('returns empty array when data is null', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      const result = await getActiveSessions()

      expect(result).toEqual([])
    })

    it('throws wrapped error on RPC failure', async () => {
      mockRpc.mockResolvedValue({ data: null, error: new Error('RPC failed') })

      await expect(getActiveSessions()).rejects.toThrow()
    })
  })

  describe('revokeSession', () => {
    it('calls the correct RPC with session ID and returns result', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null })

      const result = await revokeSession('session-1')

      expect(mockRpc).toHaveBeenCalledWith(REVOKE_SESSION_RPC, { p_session_id: 'session-1' })
      expect(result).toBe(true)
    })

    it('returns false when session was not found', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null })

      const result = await revokeSession('nonexistent')

      expect(result).toBe(false)
    })

    it('throws wrapped error on RPC failure', async () => {
      mockRpc.mockResolvedValue({ data: null, error: new Error('Cannot revoke current session') })

      await expect(revokeSession('current-session')).rejects.toThrow()
    })
  })

  describe('revokeOtherSessions', () => {
    it('calls the correct RPC and returns count', async () => {
      mockRpc.mockResolvedValue({ data: 3, error: null })

      const result = await revokeOtherSessions()

      expect(mockRpc).toHaveBeenCalledWith(REVOKE_OTHER_SESSIONS_RPC)
      expect(result).toBe(3)
    })

    it('throws wrapped error on RPC failure', async () => {
      mockRpc.mockResolvedValue({ data: null, error: new Error('Not authenticated') })

      await expect(revokeOtherSessions()).rejects.toThrow()
    })
  })

  describe('isSessionValid', () => {
    it('calls the correct RPC and returns true when session is valid', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null })

      const result = await isSessionValid()

      expect(mockRpc).toHaveBeenCalledWith(IS_SESSION_VALID_RPC)
      expect(result).toBe(true)
    })

    it('returns false when session has been revoked', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null })

      const result = await isSessionValid()

      expect(result).toBe(false)
    })

    it('throws wrapped error on RPC failure', async () => {
      mockRpc.mockResolvedValue({ data: null, error: new Error('RPC failed') })

      await expect(isSessionValid()).rejects.toThrow()
    })
  })
})
