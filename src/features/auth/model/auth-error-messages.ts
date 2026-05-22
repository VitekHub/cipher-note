import type { TFunction } from 'i18next'
import { AuthErrorCode, isAuthError, isNetworkError } from '@/shared/auth/auth-errors'

export function getAuthErrorMessage(error: unknown, t: TFunction<'auth'>): string {
  if (isAuthError(error)) {
    switch (error.code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
        return t('errors.invalidCredentials')
      case AuthErrorCode.USERNAME_TAKEN:
        return t('errors.usernameTaken')
      case AuthErrorCode.NETWORK_ERROR:
        return t('errors.networkError')
      case AuthErrorCode.KEYS_NOT_FOUND:
      case AuthErrorCode.UNEXPECTED:
        return t('errors.unexpectedError')
    }
  }

  if (isNetworkError(error)) return t('errors.networkError')

  return t('errors.unexpectedError')
}
