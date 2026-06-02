import { useMemo, type ReactNode } from 'react'
import { useAuthStore, isAuthenticated as isAuthenticatedGetter } from '@/features/auth/model/auth-store'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { AuthContext } from '@/shared/auth/auth-context'

function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore(isAuthenticatedGetter)
  const isLoading = useAuthStore((s) => s.isLoading)
  const isRestoringSession = useAuthStore((s) => s.isRestoringSession)

  const value = useMemo(
    () => ({ isAuthenticated, user, isLoading, isRestoringSession, adapter: authAdapter }),
    // authAdapter is a module-level singleton — stable reference, no need in deps
    [isAuthenticated, user, isLoading, isRestoringSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthProvider }
