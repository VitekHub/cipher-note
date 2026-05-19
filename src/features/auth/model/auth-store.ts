import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { User, UserSession } from '@/shared/types/entities/user.types'

interface AuthState {
  user: User | null
  session: UserSession | null
  isLoading: boolean
  isInitializing: boolean
}

interface AuthActions {
  setUser: (user: User | null) => void
  setSession: (session: UserSession | null) => void
  setAuth: (user: User, session: UserSession) => void
  setLoading: (isLoading: boolean) => void
  setInitializing: (isInitializing: boolean) => void
  reset: () => void
}

const isAuthenticated = (state: AuthState) => state.user !== null

const initialState: AuthState = {
  user: null,
  session: null,
  isLoading: false,
  isInitializing: true,
}

const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    (set) => ({
      ...initialState,
      setUser: (user) => set({ user }, false, 'auth/setUser'),
      setSession: (session) => set({ session }, false, 'auth/setSession'),
      setAuth: (user, session) => set({ user, session }, false, 'auth/setAuth'),
      setLoading: (isLoading) => set({ isLoading }, false, 'auth/setLoading'),
      setInitializing: (isInitializing) => set({ isInitializing }, false, 'auth/setInitializing'),
      reset: () => set({ user: null, session: null, isLoading: false }, false, 'auth/reset'),
    }),
    { name: 'AuthStore' },
  ),
)

export { useAuthStore, isAuthenticated }
export type { AuthState, AuthActions }
