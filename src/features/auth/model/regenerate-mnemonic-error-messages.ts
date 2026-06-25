import type { TFunction } from 'i18next'
import { isNetworkError } from '@/shared/lib/network-errors'
import { isAuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { isApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { DecryptionError } from '@/shared/crypto/errors'

/**
 * Maps errors from the regenerate mnemonic flow to user-facing i18n strings
 * in the 'auth' namespace.
 */
export function getRegenerateMnemonicErrorMessage(error: unknown, t: TFunction<'auth'>): string {
  if (error instanceof DecryptionError) {
    return t('regenerateMnemonic.errors.wrongPassword')
  }

  if (isAuthError(error)) {
    switch (error.code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
        return t('regenerateMnemonic.errors.wrongPassword')
      case AuthErrorCode.NETWORK_ERROR:
        return t('regenerateMnemonic.errors.networkError')
      default:
        return t('regenerateMnemonic.errors.unexpectedError')
    }
  }

  if (isApiError(error)) {
    switch (error.code) {
      case ApiErrorCode.NETWORK_ERROR:
        return t('regenerateMnemonic.errors.networkError')
      case ApiErrorCode.NOT_FOUND:
        return t('regenerateMnemonic.errors.notFound')
      default:
        return t('regenerateMnemonic.errors.unexpectedError')
    }
  }

  if (isNetworkError(error)) {
    return t('regenerateMnemonic.errors.networkError')
  }

  return t('regenerateMnemonic.errors.unexpectedError')
}
