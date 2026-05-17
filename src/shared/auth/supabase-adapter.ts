import type { User, UserSession } from '@/shared/types/entities/user.types'
import type { AuthResult, IAuthAdapter, RecoveryCredentials } from '@/shared/auth/auth.types'
import { getSupabase } from '@/shared/api/supabase-client'
import { toSupabaseEmail, fromSupabaseEmail } from '@/shared/auth/username-utils'

class SupabaseAuthAdapter implements IAuthAdapter {
  async login(username: string, authHash: string): Promise<AuthResult> {
    const email = toSupabaseEmail(username)
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email,
      password: authHash,
    })

    if (error) throw error
    if (!data.user || !data.session) throw new Error('Login failed: no user or session returned')

    return mapSupabaseToAuthResult(data.user, data.session)
  }

  async signup(username: string, authHash: string, keySalt: string): Promise<AuthResult> {
    const email = toSupabaseEmail(username)
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password: authHash,
      options: {
        data: {
          username,
          key_salt: keySalt,
        },
      },
    })

    if (error) throw error
    if (!data.user) throw new Error('Signup failed: no user returned')
    if (!data.session) {
      throw new Error('Signup requires email confirmation. Please check your email to confirm your account.')
    }

    return mapSupabaseToAuthResult(data.user, data.session)
  }

  async logout(): Promise<void> {
    const { error } = await getSupabase().auth.signOut()
    if (error) throw error
  }

  async getSession(): Promise<AuthResult | null> {
    const { data, error } = await getSupabase().auth.getSession()
    if (error) throw error
    if (!data.session) return null

    return mapSupabaseToAuthResult(data.session.user, data.session)
  }

  async recoverPassword(_username: string, _recoveryData: RecoveryCredentials): Promise<void> {
    throw new Error('Password recovery is not yet implemented')
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
