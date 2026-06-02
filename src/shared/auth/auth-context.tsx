import { createContext, useContext } from 'react'
import type { IAuthAdapter } from '@/shared/auth/auth.types'

export interface AuthContext {
  isAuthenticated: boolean
  user: { id: string; username: string } | null
  isLoading: boolean
  isRestoringSession: boolean
  adapter: IAuthAdapter
}

export const AuthContext = createContext<AuthContext | null>(null)

function useAuth(): AuthContext {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export { useAuth }
