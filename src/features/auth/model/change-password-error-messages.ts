import type { TFunction } from 'i18next'
import { isNetworkError } from '@/shared/lib/network-errors'
import { isAuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { isApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { DecryptionError } from '@/shared/crypto/errors'

/**
 * Maps errors from the change password flow to user-facing i18n strings
 * in the 'auth' namespace.
 */
export function getChangePasswordErrorMessage(error: unknown, t: TFunction<'auth'>): string {
  if (error instanceof DecryptionError) {
    return t('changePassword.errors.wrongCurrentPassword')
  }

  if (isAuthError(error)) {
    switch (error.code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
        return t('changePassword.errors.authFailed')
      case AuthErrorCode.NETWORK_ERROR:
        return t('changePassword.errors.networkError')
      default:
        return t('changePassword.errors.unexpectedError')
    }
  }

  if (isApiError(error)) {
    switch (error.code) {
      case ApiErrorCode.NETWORK_ERROR:
        return t('changePassword.errors.networkError')
      case ApiErrorCode.NOT_FOUND:
        return t('changePassword.errors.notFound')
      default:
        return t('changePassword.errors.unexpectedError')
    }
  }

  if (isNetworkError(error)) {
    return t('changePassword.errors.networkError')
  }

  return t('changePassword.errors.unexpectedError')
}
