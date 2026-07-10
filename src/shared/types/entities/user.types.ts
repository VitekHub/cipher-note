export interface User {
  id: string
  username: string
  createdAt: string
}

export interface UserSession {
  accessToken: string
  expiresAt: number
}

/** Active session returned by the get_active_sessions RPC. */
export interface ActiveSession {
  id: string
  created_at: string
  updated_at: string
  user_agent: string | null
  ip: string | null
  not_after: string | null
}
