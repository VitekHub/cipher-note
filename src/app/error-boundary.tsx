import { useTranslation } from 'react-i18next'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/shared/ui/button'
import { DecryptionError, CorruptedDataError } from '@/shared/crypto/errors'

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
