import { useTranslation } from 'react-i18next'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/shared/ui/button'
import { Argon2Error, CorruptedDataError, DecryptionError, MnemonicError } from '@/shared/crypto/core/errors'
import { AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiErrorCode } from '@/shared/api/api-errors'
import { mapErrorToMessage, type ErrorKeySpec } from '@/shared/lib/error-messages'

/**
 * Spec for fatal route errors. Crypto errors get their dedicated copy; network
 * errors get a network message; everything else falls back to the generic
 * unexpected-error copy. Reused via the shared `mapErrorToMessage` so this
 * stays in sync with the per-feature mappers.
 */
const ROUTE_ERROR_SPEC: ErrorKeySpec = {
  instanceChecks: [
    [DecryptionError, 'vault:errors.decryptFailed'],
    [CorruptedDataError, 'vault:errors.corruptedData'],
    [Argon2Error, 'vault:errors.argon2Failed'],
    [MnemonicError, 'auth:errors.mnemonicFailed'],
  ],
  authCodes: {
    [AuthErrorCode.NETWORK_ERROR]: 'common:errors.networkError',
  },
  apiCodes: {
    [ApiErrorCode.NETWORK_ERROR]: 'common:errors.networkError',
  },
  networkKey: 'common:errors.networkError',
  fallbackKey: 'common:errors.unexpectedError',
}

function RouteErrorBoundary({ error }: ErrorComponentProps) {
  const { t } = useTranslation()
  const err = error instanceof Error ? error : new Error(String(error))
  const description = mapErrorToMessage(err, t, ROUTE_ERROR_SPEC)

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-foreground text-2xl font-bold">{t('common:status.error')}</h1>
        <p className="text-muted-foreground mt-2">{description}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {t('common:actions.retry')}
        </Button>
      </div>
    </div>
  )
}

export { RouteErrorBoundary, ROUTE_ERROR_SPEC }
