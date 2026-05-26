import { create } from 'zustand'
import type { User, UserSession } from '@/shared/types/entities/user.types'

interface AuthState {
  user: User | null
  session: UserSession | null
  isLoading: boolean
  isRestoringSession: boolean
}

interface AuthActions {
  setUser: (user: User | null) => void
  setSession: (session: UserSession | null) => void
  setAuth: (user: User, session: UserSession) => void
  setLoading: (isLoading: boolean) => void
  setRestoringSession: (isRestoringSession: boolean) => void
  reset: () => void
}

const isAuthenticated = (state: AuthState) => state.user !== null

const initialState: AuthState = {
  user: null,
  session: null,
  isLoading: false,
  isRestoringSession: true,
}

const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  ...initialState,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setAuth: (user, session) => set({ user, session }),
  setLoading: (isLoading) => set({ isLoading }),
  setRestoringSession: (isRestoringSession) => set({ isRestoringSession }),
  // reset clears auth data but preserves isRestoringSession — logout doesn't re-trigger session restoration
  reset: () => set({ user: null, session: null, isLoading: false }),
}))

export { useAuthStore, isAuthenticated }
export type { AuthState, AuthActions }
