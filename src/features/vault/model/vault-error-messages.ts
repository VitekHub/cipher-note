import type { TFunction } from 'i18next'

import { DecryptionError, CorruptedDataError, Argon2Error } from '@/shared/crypto/errors'
import { isNetworkError } from '@/shared/lib/network-errors'

export function getVaultErrorMessage(error: unknown, t: TFunction<'crypto'>): string {
  if (error instanceof DecryptionError) return t('errors.wrongPassword')
  if (error instanceof CorruptedDataError) return t('errors.corruptedData')
  if (error instanceof Argon2Error) return t('errors.argon2Failed')

  if (isNetworkError(error)) return t('errors.networkError')

  return t('errors.unexpectedError')
}
