import { useTranslation } from 'react-i18next'
import { Loader2, Check, AlertCircle, CloudOff } from 'lucide-react'
import type { SyncStatus } from '@/features/fields/model/sync-status-store'
import { cn } from '@/shared/lib/utils'

// Static keys so i18next-parser can discover them
const STATUS_I18N_KEYS: Record<SyncStatus, { text: string; retry?: string }> = {
  idle: { text: '' },
  saving: { text: 'status.saving' },
  paused: { text: 'status.paused' },
  saved: { text: 'status.saved' },
  error: { text: 'status.error', retry: 'status.retry' },
}

interface SaveIndicatorProps {
  status: SyncStatus
  onRetry?: () => void
  className?: string
}

function SaveIndicator({ status, onRetry, className }: SaveIndicatorProps) {
  const { t } = useTranslation('fields')

  if (status === 'idle') return null

  const keys = STATUS_I18N_KEYS[status]

  if (status === 'saving') {
    return (
      <span className={cn('text-muted-foreground inline-flex items-center gap-1 text-xs', className)}>
        <Loader2 className="size-3 animate-spin" />
        {t(keys.text)}
      </span>
    )
  }

  if (status === 'paused') {
    return (
      <span className={cn('inline-flex animate-pulse items-center gap-1 text-xs', className)}>
        <CloudOff className="size-3" />
        {t(keys.text)}
      </span>
    )
  }

  if (status === 'saved') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400', className)}>
        <Check className="size-3" />
        {t(keys.text)}
      </span>
    )
  }

  // status === 'error'
  return (
    <span className={cn('text-destructive inline-flex items-center gap-1 text-xs', className)}>
      <AlertCircle className="size-3" />
      {t(keys.text)}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-primary hover:text-primary/80 cursor-pointer underline underline-offset-2"
        >
          {t(keys.retry!)}
        </button>
      )}
    </span>
  )
}

export { SaveIndicator }
