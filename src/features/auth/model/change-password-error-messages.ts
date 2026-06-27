import type { TFunction } from 'i18next'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiErrorCode } from '@/shared/api/api-errors'
import { mapErrorToMessage, type ErrorKeySpec } from '@/shared/lib/error-messages'

const CHANGE_PASSWORD_ERROR_SPEC: ErrorKeySpec = {
  instanceChecks: [[DecryptionError, 'changePassword.errors.wrongCurrentPassword']],
  authCodes: {
    [AuthErrorCode.INVALID_CREDENTIALS]: 'changePassword.errors.authFailed',
    [AuthErrorCode.NETWORK_ERROR]: 'changePassword.errors.networkError',
  },
  apiCodes: {
    [ApiErrorCode.NETWORK_ERROR]: 'changePassword.errors.networkError',
    [ApiErrorCode.NOT_FOUND]: 'changePassword.errors.notFound',
  },
  networkKey: 'changePassword.errors.networkError',
  fallbackKey: 'changePassword.errors.unexpectedError',
}

/**
 * Maps errors from the change password flow to user-facing i18n strings
 * in the 'auth' namespace.
 */
export function getChangePasswordErrorMessage(error: unknown, t: TFunction<'auth'>): string {
  return mapErrorToMessage(error, t, CHANGE_PASSWORD_ERROR_SPEC)
}
