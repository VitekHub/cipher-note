import type { TFunction } from 'i18next'
import { DecryptionError, CorruptedDataError, Argon2Error } from '@/shared/crypto/core/errors'
import { mapErrorToMessage, type ErrorKeySpec } from '@/shared/lib/error-messages'

const VAULT_ERROR_SPEC: ErrorKeySpec = {
  instanceChecks: [
    [DecryptionError, 'errors.wrongPassword'],
    [CorruptedDataError, 'errors.corruptedData'],
    [Argon2Error, 'errors.argon2Failed'],
  ],
  networkKey: 'common:errors.networkError',
  fallbackKey: 'common:errors.unexpectedError',
}

export function getVaultErrorMessage(error: unknown, t: TFunction<'vault'>): string {
  return mapErrorToMessage(error, t, VAULT_ERROR_SPEC)
}
