import type { TFunction } from 'i18next'
import { AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiErrorCode } from '@/shared/api/api-errors'
import { mapErrorToMessage, type ErrorKeySpec } from '@/shared/lib/error-messages'

const DELETE_ACCOUNT_ERROR_SPEC: ErrorKeySpec = {
  authCodes: {
    [AuthErrorCode.INVALID_CREDENTIALS]: 'deleteAccount.errors.wrongPassword',
    [AuthErrorCode.NETWORK_ERROR]: 'deleteAccount.errors.networkError',
  },
  apiCodes: {
    [ApiErrorCode.NETWORK_ERROR]: 'deleteAccount.errors.networkError',
  },
  networkKey: 'deleteAccount.errors.networkError',
  fallbackKey: 'deleteAccount.errors.unexpectedError',
}

/**
 * Maps errors from the delete account flow to user-facing i18n strings
 * in the 'auth' namespace.
 */
export function getDeleteAccountErrorMessage(error: unknown, t: TFunction<'auth'>): string {
  return mapErrorToMessage(error, t, DELETE_ACCOUNT_ERROR_SPEC)
}
