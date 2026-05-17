export interface User {
  id: string
  username: string
  createdAt: string
}

export interface UserSession {
  accessToken: string
  expiresAt: number
}
