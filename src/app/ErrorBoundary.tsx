import { useTranslation } from 'react-i18next'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/shared/ui/button'
import { Argon2Error, CorruptedDataError, DecryptionError, MnemonicError } from '@/shared/crypto/core/errors'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'

/** Crypto errors with fixed descriptions — add new ones here instead of extending the if-chain. */
const CRYPTO_ERRORS: readonly (readonly [new () => Error, string])[] = [
  [DecryptionError, 'vault:errors.decryptFailed'],
  [CorruptedDataError, 'vault:errors.corruptedData'],
  [Argon2Error, 'vault:errors.argon2Failed'],
  [MnemonicError, 'auth:errors.mnemonicFailed'],
]

function getErrorMessage(error: Error): { title: string; description: string } {
  for (const [ErrorClass, description] of CRYPTO_ERRORS) {
    if (error instanceof ErrorClass) {
      return { title: 'common:status.error', description }
    }
  }

  if (error instanceof AuthError) {
    return error.code === AuthErrorCode.NETWORK_ERROR
      ? { title: 'common:status.error', description: 'common:errors.networkError' }
      : { title: 'common:status.error', description: 'common:errors.unexpectedError' }
  }

  if (error instanceof ApiError) {
    return error.code === ApiErrorCode.NETWORK_ERROR
      ? { title: 'common:status.error', description: 'common:errors.networkError' }
      : { title: 'common:status.error', description: 'common:errors.unexpectedError' }
  }

  return {
    title: 'common:status.error',
    description: error.message || 'common:status.error',
  }
}

function RootErrorBoundary({ error }: ErrorComponentProps) {
  const { t } = useTranslation()
  const err = error instanceof Error ? error : new Error(String(error))
  const { title, description } = getErrorMessage(err)

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-foreground text-2xl font-bold">{t(title)}</h1>
        <p className="text-muted-foreground mt-2">{description.includes(':') ? t(description) : description}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {t('common:actions.retry')}
        </Button>
      </div>
    </div>
  )
}

export { RootErrorBoundary }
