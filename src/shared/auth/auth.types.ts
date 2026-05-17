import type { User, UserSession } from '@/shared/types/entities/user.types'

export interface AuthResult {
  user: User
  session: UserSession
}

export interface IAuthAdapter {
  login(username: string, authHash: string): Promise<AuthResult>
  logout(): Promise<void>
  getSession(): Promise<AuthResult | null>
  signup(username: string, authHash: string, keySalt: string): Promise<AuthResult>
  recoverPassword(username: string, recoveryData: RecoveryCredentials): Promise<void>
}

export interface RecoveryCredentials {
  mnemonic: string
  newPasswordAuthHash: string
  newKeySalt: string
}
