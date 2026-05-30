import { isNetworkError } from '@/shared/lib/network-errors'

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

/**
 * Wrap an unknown error as an AuthError.
 * Network errors map to NETWORK_ERROR, everything else to UNEXPECTED.
 */
export function wrapAuthError(error: unknown): AuthError {
  const cause = error instanceof Error ? error : undefined
  if (isNetworkError(error)) {
    return new AuthError(AuthErrorCode.NETWORK_ERROR, { cause })
  }
  return new AuthError(AuthErrorCode.UNEXPECTED, { cause })
}
