import type { User, UserSession } from '@/shared/types/entities/user.types'
import type {
  AuthResult,
  AuthStateChangeCallback,
  AuthUnsubscribe,
  IAuthAdapter,
  RecoveryCredentials,
} from '@/shared/auth/auth.types'
import { getSupabase } from '@/shared/api/supabase-client'
import { toSupabaseEmail, fromSupabaseEmail } from '@/shared/auth/username-utils'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { isNetworkError } from '@/shared/lib/network-errors'

class SupabaseAuthAdapter implements IAuthAdapter {
  async login(username: string, authHash: string): Promise<AuthResult> {
    const email = toSupabaseEmail(username)
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email,
      password: authHash,
    })

    if (error) throw wrapSupabaseAuthError(error)
    if (!data.user || !data.session) throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS)

    return mapSupabaseToAuthResult(data.user, data.session)
  }

  async signup(username: string, authHash: string): Promise<AuthResult> {
    const email = toSupabaseEmail(username)
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password: authHash,
      options: {
        data: {
          username,
        },
      },
    })

    if (error) throw wrapSupabaseAuthError(error)
    if (!data.user) throw new AuthError(AuthErrorCode.UNEXPECTED)
    if (!data.session) {
      throw new AuthError(AuthErrorCode.UNEXPECTED)
    }

    return mapSupabaseToAuthResult(data.user, data.session)
  }

  async logout(): Promise<void> {
    const { error } = await getSupabase().auth.signOut()
    if (error) throw wrapSupabaseAuthError(error)
  }

  async getSession(): Promise<AuthResult | null> {
    const { data, error } = await getSupabase().auth.getSession()
    if (error) throw wrapSupabaseAuthError(error)
    if (!data.session) return null

    return mapSupabaseToAuthResult(data.session.user, data.session)
  }

  async recoverPassword(_username: string, _recoveryData: RecoveryCredentials): Promise<void> {
    throw new AuthError(AuthErrorCode.UNEXPECTED)
  }

  async updatePassword(newAuthHash: string): Promise<void> {
    const { error } = await getSupabase().auth.updateUser({ password: newAuthHash })
    if (error) throw wrapSupabaseAuthError(error)
  }

  onAuthStateChange(callback: AuthStateChangeCallback): AuthUnsubscribe {
    const { data } = getSupabase().auth.onAuthStateChange((_event, supabaseSession) => {
      if (!supabaseSession) {
        callback(null)
        return
      }
      callback(mapSupabaseToAuthResult(supabaseSession.user, supabaseSession))
    })
    return data.subscription.unsubscribe
  }
}

export function mapSupabaseToAuthResult(
  supabaseUser: {
    id: string
    created_at: string
    email?: string | null
    user_metadata?: Record<string, unknown>
  },
  supabaseSession: { access_token: string; expires_at?: number },
): AuthResult {
  const user: User = {
    id: supabaseUser.id,
    username:
      (supabaseUser.user_metadata?.username as string | undefined) ?? fromSupabaseEmail(supabaseUser.email ?? ''),
    createdAt: supabaseUser.created_at,
  }

  const session: UserSession = {
    accessToken: supabaseSession.access_token,
    expiresAt: supabaseSession.expires_at ?? 0,
  }

  return { user, session }
}

export const authAdapter = new SupabaseAuthAdapter()

// Supabase auth errors have their own status/code mapping (e.g. 400 invalid_credentials,
// 409 user_already_exists), so we can't use the generic wrapAuthError here.
function wrapSupabaseAuthError(error: unknown): AuthError {
  if (isNetworkError(error)) {
    return new AuthError(AuthErrorCode.NETWORK_ERROR, { cause: error instanceof Error ? error : undefined })
  }

  if (typeof error === 'object' && error !== null && 'status' in error && 'code' in error) {
    const authError = error as { status: number; code: string }
    const supabaseError = new Error(`Supabase auth error: ${authError.status} ${authError.code}`, {
      cause: error instanceof Error ? error : undefined,
    })
    if (authError.status === 400 && authError.code === 'invalid_credentials') {
      return new AuthError(AuthErrorCode.INVALID_CREDENTIALS, { cause: supabaseError })
    }
    if (authError.status === 409 || authError.status === 422 || authError.code === 'user_already_exists') {
      return new AuthError(AuthErrorCode.USERNAME_TAKEN, { cause: supabaseError })
    }
  }

  return new AuthError(AuthErrorCode.UNEXPECTED, { cause: error instanceof Error ? error : undefined })
}
