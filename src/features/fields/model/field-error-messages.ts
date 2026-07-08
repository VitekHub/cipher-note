import type { TFunction } from 'i18next'
import { DecryptionError, CorruptedDataError } from '@/shared/crypto/core/errors'
import { mapErrorToMessage, type ErrorKeySpec } from '@/shared/lib/error-messages'

/**
 * Error spec for field-load failures. A `DecryptionError` means the field's
 * ciphertext is corrupted or the field key is wrong; everything else is a
 * load failure (network, RPC error, etc.).
 */
const FIELD_LOAD_ERROR_SPEC: ErrorKeySpec = {
  instanceChecks: [
    [DecryptionError, 'vault:errors.decryptFailed'],
    [CorruptedDataError, 'vault:errors.corruptedData'],
  ],
  networkKey: 'common:errors.networkError',
  fallbackKey: 'fields:errors.loadFailed',
}

/** Maps a field-load error to a user-facing i18n string. */
export function getFieldLoadErrorMessage(error: unknown, t: TFunction): string {
  return mapErrorToMessage(error, t, FIELD_LOAD_ERROR_SPEC)
}

export { FIELD_LOAD_ERROR_SPEC }
