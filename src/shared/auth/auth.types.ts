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
  signup(username: string, authHash: string, keySalt: string): Promise<AuthResult>
  recoverPassword(username: string, recoveryData: RecoveryCredentials): Promise<void>
  onAuthStateChange(callback: AuthStateChangeCallback): AuthUnsubscribe
}

/** Credentials needed to recover a forgotten password. */
export interface RecoveryCredentials {
  /** BIP-39 mnemonic used to re-derive the original key salt. */
  mnemonic: string
  /** New argon2id hash of the user's new password. */
  newPasswordAuthHash: string
  /** New salt for re-deriving the master key. */
  newKeySalt: string
}
