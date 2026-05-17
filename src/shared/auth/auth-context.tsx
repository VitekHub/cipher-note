import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuthStore, isAuthenticated as isAuthenticatedGetter } from '@/features/auth/model/auth-store'

export interface AuthContext {
  isAuthenticated: boolean
  user: { id: string; username: string } | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContext | null>(null)

function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore(isAuthenticatedGetter)
  const isLoading = useAuthStore((s) => s.isLoading)

  const value = useMemo<AuthContext>(() => ({ isAuthenticated, user, isLoading }), [isAuthenticated, user, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth(): AuthContext {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export { AuthProvider, useAuth }
