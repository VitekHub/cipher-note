import { createContext, useContext, type ReactNode } from 'react'

export interface AuthContext {
  isAuthenticated: boolean
  user: { id: string; username: string } | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContext | null>(null)

function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContext = {
    isAuthenticated: false,
    user: null,
    isLoading: false,
  }

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
