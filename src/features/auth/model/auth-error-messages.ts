import type { TFunction } from 'i18next'
import { AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiErrorCode } from '@/shared/api/api-errors'
import { mapErrorToMessage, type ErrorKeySpec } from '@/shared/lib/error-messages'

const AUTH_ERROR_SPEC: ErrorKeySpec = {
  authCodes: {
    [AuthErrorCode.INVALID_CREDENTIALS]: 'errors.invalidCredentials',
    [AuthErrorCode.USERNAME_TAKEN]: 'errors.usernameTaken',
    [AuthErrorCode.NETWORK_ERROR]: 'errors.networkError',
    [AuthErrorCode.UNEXPECTED]: 'errors.unexpectedError',
  },
  apiCodes: {
    [ApiErrorCode.NETWORK_ERROR]: 'errors.networkError',
    [ApiErrorCode.NOT_FOUND]: 'errors.unexpectedError',
    [ApiErrorCode.UNEXPECTED]: 'errors.unexpectedError',
  },
  networkKey: 'errors.networkError',
  fallbackKey: 'errors.unexpectedError',
}

export function getAuthErrorMessage(error: unknown, t: TFunction<'auth'>): string {
  return mapErrorToMessage(error, t, AUTH_ERROR_SPEC)
}
