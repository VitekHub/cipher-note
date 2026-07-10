import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { getActiveSessions, revokeSession, revokeOtherSessions } from '@/shared/api/supabase-session'
import { queryKeys } from '@/shared/lib/query-keys'
import { sessionUpdateChannel } from '@/shared/realtime/session-update'
import { useAuthStore } from '@/features/auth/model/auth-store'

/** Fetch all active sessions for the current user. */
export function useActiveSessions() {
  return useQuery({
    queryKey: queryKeys.session.list,
    queryFn: getActiveSessions,
  })
}

/** Invalidate the session list query and broadcast the change to other devices. */
function onSessionMutated(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.session.list })
  const userId = useAuthStore.getState().user?.id
  if (userId) sessionUpdateChannel.broadcastUpdate(userId)
}

/** Revoke a specific session. */
export function useRevokeSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: revokeSession,
    onSuccess: () => onSessionMutated(queryClient),
  })
}

/** Revoke all sessions except the current one. */
export function useRevokeOtherSessions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => onSessionMutated(queryClient),
  })
}
