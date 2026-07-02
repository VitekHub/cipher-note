import type { TFunction } from 'i18next'
import { DecryptionError, MnemonicError } from '@/shared/crypto/core/errors'
import { AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiErrorCode } from '@/shared/api/api-errors'
import { mapErrorToMessage, type ErrorKeySpec } from '@/shared/lib/error-messages'

const REGENERATE_MNEMONIC_ERROR_SPEC: ErrorKeySpec = {
  instanceChecks: [[DecryptionError, 'regenerateMnemonic.errors.wrongPassword']],
  authCodes: {
    [AuthErrorCode.INVALID_CREDENTIALS]: 'regenerateMnemonic.errors.wrongPassword',
    [AuthErrorCode.NETWORK_ERROR]: 'regenerateMnemonic.errors.networkError',
  },
  apiCodes: {
    [ApiErrorCode.NETWORK_ERROR]: 'regenerateMnemonic.errors.networkError',
    [ApiErrorCode.NOT_FOUND]: 'regenerateMnemonic.errors.notFound',
  },
  networkKey: 'regenerateMnemonic.errors.networkError',
  fallbackKey: 'regenerateMnemonic.errors.unexpectedError',
}

const RECOVERY_ERROR_SPEC: ErrorKeySpec = {
  instanceChecks: [
    [DecryptionError, 'recover.errors.wrongMnemonic'],
    [MnemonicError, 'recover.errors.invalidMnemonic'],
  ],
  authCodes: {
    [AuthErrorCode.INVALID_CREDENTIALS]: 'recover.errors.recoveryFailed',
    [AuthErrorCode.NETWORK_ERROR]: 'recover.errors.networkError',
  },
  apiCodes: {
    [ApiErrorCode.NETWORK_ERROR]: 'recover.errors.networkError',
    [ApiErrorCode.NOT_FOUND]: 'recover.errors.accountNotFound',
  },
  networkKey: 'recover.errors.networkError',
  fallbackKey: 'recover.errors.unexpectedError',
}

/**
 * Maps errors from the regenerate mnemonic flow to user-facing i18n strings
 * in the 'auth' namespace.
 */
export function getRegenerateMnemonicErrorMessage(error: unknown, t: TFunction<'auth'>): string {
  return mapErrorToMessage(error, t, REGENERATE_MNEMONIC_ERROR_SPEC)
}

/**
 * Maps errors from the account recovery flow to user-facing i18n strings
 * in the 'auth' namespace.
 */
export function getRecoveryErrorMessage(error: unknown, t: TFunction<'auth'>): string {
  return mapErrorToMessage(error, t, RECOVERY_ERROR_SPEC)
}
