import { useTranslation } from 'react-i18next'
import { Check, AlertCircle, CloudOff, CloudDownload } from 'lucide-react'
import { SYNC_STATUS } from '@/features/fields/model/sync-status-store'
import type { SyncStatus } from '@/features/fields/model/sync-status-store'
import { Spinner } from '@/shared/ui/Spinner'
import { cn } from '@/shared/lib/utils'

// Static keys so i18next-parser can discover them
const STATUS_I18N_KEYS: Record<SyncStatus, { text: string; retry?: string }> = {
  [SYNC_STATUS.IDLE]: { text: '' },
  [SYNC_STATUS.DIRTY]: { text: '' },
  [SYNC_STATUS.SAVING]: { text: 'status.saving' },
  [SYNC_STATUS.PAUSED]: { text: 'status.paused' },
  [SYNC_STATUS.SAVED]: { text: 'status.saved' },
  [SYNC_STATUS.ERROR]: { text: 'status.error', retry: 'status.retry' },
  [SYNC_STATUS.REMOTE_UPDATE]: { text: 'status.remoteUpdate' },
}

interface SaveIndicatorProps {
  status: SyncStatus
  onRetry?: () => void
  className?: string
}

function SaveIndicator({ status, onRetry, className }: SaveIndicatorProps) {
  const { t } = useTranslation('fields')

  if (status === SYNC_STATUS.IDLE || status === SYNC_STATUS.DIRTY) return null

  const keys = STATUS_I18N_KEYS[status]

  if (status === SYNC_STATUS.SAVING) {
    return (
      <span className={cn('text-muted-foreground inline-flex items-center gap-1 text-xs', className)}>
        <Spinner size="sm" />
        {t(keys.text)}
      </span>
    )
  }

  if (status === SYNC_STATUS.PAUSED) {
    return (
      <span className={cn('inline-flex animate-pulse items-center gap-1 text-xs', className)}>
        <CloudOff className="size-3" />
        {t(keys.text)}
      </span>
    )
  }

  if (status === SYNC_STATUS.SAVED) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400', className)}>
        <Check className="size-3" />
        {t(keys.text)}
      </span>
    )
  }

  if (status === SYNC_STATUS.REMOTE_UPDATE) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400', className)}>
        <CloudDownload className="size-3" />
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
