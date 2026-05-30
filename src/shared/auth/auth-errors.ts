export const AuthErrorCode = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNEXPECTED: 'UNEXPECTED',
} as const

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode]

export class AuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode, options?: ErrorOptions) {
    super(`AuthError: ${code}`, options)
    this.name = 'AuthError'
    this.code = code
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') return true
  if (error instanceof Error) {
    const msg = error.message
    if (msg === 'Failed to fetch' || msg === 'NetworkError') return true
    const lower = msg.toLowerCase()
    if (lower.includes('network') || lower.includes('failed to fetch')) return true
  }
  return false
}
