import { useTranslation } from 'react-i18next'
import { FileX, Trash2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { ENTRY_STATUS } from '@/features/fields/model/entry-status'
import type { EntryStatus } from '@/features/fields/model/entry-status'

function EntryStatusBanner({ status }: { status: EntryStatus }) {
  const { t } = useTranslation('entries')

  if (status === ENTRY_STATUS.LOADING || status === ENTRY_STATUS.VALID) return null

  const isDeleted = status === ENTRY_STATUS.DELETED

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'animate-fade-in-up flex items-center justify-center border-b px-4 py-1.5 text-sm backdrop-blur-sm',
        isDeleted
          ? 'border-amber-200 bg-amber-50/95 text-amber-800 dark:border-amber-800 dark:bg-amber-950/95 dark:text-amber-200'
          : 'border-rose-200 bg-rose-50/95 text-rose-800 dark:border-rose-800 dark:bg-rose-950/95 dark:text-rose-200',
      )}
    >
      {isDeleted ? (
        <Trash2 className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <FileX className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="ml-2">{isDeleted ? t('deleted') : t('notFound')}</span>
    </div>
  )
}

export { EntryStatusBanner }
