import type { User, UserSession } from '@/shared/types/entities/user.types'

/** Result of a successful authentication operation. */
export interface AuthResult {
  user: User
  session: UserSession
}

/** Callback invoked when auth state changes. */
export type AuthStateChangeCallback = (result: AuthResult | null) => void

/** Unsubscribe function returned by onAuthStateChange. */
export type AuthUnsubscribe = () => void

/** Adapter for authentication providers (e.g. Supabase). */
export interface IAuthAdapter {
  login(username: string, authHash: string): Promise<AuthResult>
  logout(): Promise<void>
  getSession(): Promise<AuthResult | null>
  signup(username: string, authHash: string): Promise<AuthResult>
  recoverPassword(username: string, recoveryData: RecoveryCredentials): Promise<string>
  updatePassword(newAuthHash: string): Promise<void>
  deleteAccount(): Promise<void>
  onAuthStateChange(callback: AuthStateChangeCallback): AuthUnsubscribe
}

/** Credentials for the auth adapter's recoverPassword method. */
export interface RecoveryCredentials {
  /** New argon2id-derived auth hash for Supabase Auth. */
  newPasswordAuthHash: string
  /** New KDF salt for re-deriving the password key. */
  newKeySalt: string
}
