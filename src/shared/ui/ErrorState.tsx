import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { cn } from '@/shared/lib/utils'

interface ErrorStateProps {
  title: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

function resolveText(t: (key: string) => string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return value.includes(':') ? t(value) : value
}

/** Centered error card with a "Go home" link and an optional retry button. */
function ErrorState({ title, description, onRetry, retryLabel = 'common:actions.retry', className }: ErrorStateProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className={cn('flex min-h-full flex-1 items-center justify-center', className)}>
      <Card size="sm" className="max-w-sm">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="size-4" />
            {resolveText(t, title)}
          </CardTitle>
        </CardHeader>
        {description && <CardContent className="text-muted-foreground">{resolveText(t, description)}</CardContent>}
        <CardContent className="flex flex-col gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="w-full">
              {t(retryLabel)}
            </Button>
          )}
          <Button
            variant={onRetry ? 'outline' : 'default'}
            onClick={() => void navigate({ to: '/' })}
            className="w-full"
          >
            {t('common:actions.goHome')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export { ErrorState }
export type { ErrorStateProps }
