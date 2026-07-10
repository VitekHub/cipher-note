import { useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { useRequiredUserId } from '@/shared/auth/use-current-user'
import { useAuthStore, isAuthenticated as isAuthenticatedSelector } from '@/features/auth/model/auth-store'
import { sessionUpdateChannel } from '@/shared/realtime/session-update'
import { isSessionValid } from '@/shared/api/supabase-session'
import { logoutUser } from '@/features/auth/model/auth-service'
import { queryKeys } from '@/shared/lib/query-keys'

/**
 * Reacts to cross-device session changes by checking validity.
 *
 * Three triggers call `checkSessionValidity`:
 * 1. **Realtime broadcast** — another device added/revoked a session.
 *    Revoked → force-logout with toast; valid → refresh session list.
 * 2. **Online event** — catches changes missed while offline.
 * 3. **Mount check** — catches revocation after app reopen.
 */
function useSessionUpdateListener(): void {
  const userId = useRequiredUserId()
  const isRestoringSession = useAuthStore((s) => s.isRestoringSession)
  const queryClient = useQueryClient()
  const { t } = useTranslation('auth')

  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  const checkSessionValidity = useCallback(async () => {
    try {
      const valid = await isSessionValid()
      if (!valid) {
        toast.error(tRef.current('session.revokedElsewhere'))
        void logoutUser()
      } else {
        // Session is valid, but the list may have changed — refresh it
        await queryClient.invalidateQueries({ queryKey: queryKeys.session.list })
      }
    } catch {
      // Network error — don't force-logout; next trigger will retry
    }
  }, [queryClient])

  useEffect(() => {
    if (!isAuthenticatedSelector(useAuthStore.getState()) || isRestoringSession) return

    // Realtime broadcast: subscribe to session update channel
    sessionUpdateChannel.subscribe(userId, () => {
      void checkSessionValidity()
    })

    // Mount check: catch revoked session after app reopen
    void checkSessionValidity()

    // Online event: catch revoked session after offline period
    window.addEventListener('online', checkSessionValidity)

    return () => {
      sessionUpdateChannel.unsubscribe()
      window.removeEventListener('online', checkSessionValidity)
    }
  }, [userId, isRestoringSession, checkSessionValidity])
}

export { useSessionUpdateListener }
