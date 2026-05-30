import { useTranslation } from 'react-i18next'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/shared/ui/button'
import { Argon2Error, CorruptedDataError, DecryptionError, MnemonicError } from '@/shared/crypto/errors'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'

function getErrorMessage(error: Error): { title: string; description: string } {
  if (error instanceof DecryptionError) {
    return {
      title: 'common:status.error',
      description: 'crypto:errors.decryptFailed',
    }
  }
  if (error instanceof CorruptedDataError) {
    return {
      title: 'common:status.error',
      description: 'crypto:errors.corruptedData',
    }
  }
  if (error instanceof Argon2Error) {
    return {
      title: 'common:status.error',
      description: 'crypto:errors.argon2Failed',
    }
  }
  if (error instanceof MnemonicError) {
    return {
      title: 'common:status.error',
      description: 'crypto:errors.mnemonicFailed',
    }
  }
  if (error instanceof AuthError) {
    if (error.code === AuthErrorCode.NETWORK_ERROR) {
      return {
        title: 'common:status.error',
        description: 'common:errors.networkError',
      }
    }
    return {
      title: 'common:status.error',
      description: 'common:errors.unexpectedError',
    }
  }
  if (error instanceof ApiError) {
    if (error.code === ApiErrorCode.NETWORK_ERROR) {
      return {
        title: 'common:status.error',
        description: 'common:errors.networkError',
      }
    }
    return {
      title: 'common:status.error',
      description: 'common:errors.unexpectedError',
    }
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
