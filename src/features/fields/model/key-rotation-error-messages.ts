import type { TFunction } from 'i18next'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiErrorCode } from '@/shared/api/api-errors'
import { mapErrorToMessage, type ErrorKeySpec } from '@/shared/lib/error-messages'

/**
 * Error spec for field-key rotation.
 *
 * The RPC is atomic, so any failure means nothing changed server-side. The
 * messages reflect that: a failed rotation never leaves the vault in a broken
 * state. The fallback covers the vault-locked throw and any other generic
 * Error.
 */
const KEY_ROTATION_ERROR_SPEC: ErrorKeySpec = {
  instanceChecks: [[DecryptionError, 'rotation.staleVault']],
  authCodes: {
    [AuthErrorCode.NETWORK_ERROR]: 'rotation.networkError',
  },
  apiCodes: {
    [ApiErrorCode.NETWORK_ERROR]: 'rotation.networkError',
    [ApiErrorCode.UNEXPECTED]: 'rotation.failed',
  },
  networkKey: 'rotation.networkError',
  fallbackKey: 'rotation.locked',
}

/**
 * Maps field-key rotation errors to user-facing i18n strings in the 'vault'
 * namespace.
 */
export function getKeyRotationErrorMessage(error: unknown, t: TFunction<'vault'>): string {
  return mapErrorToMessage(error, t, KEY_ROTATION_ERROR_SPEC)
}
