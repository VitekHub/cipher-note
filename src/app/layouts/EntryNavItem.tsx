import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useField } from '@/features/fields/model/use-field'

interface EntryNavItemProps {
  entryId: string
  index: number
  isVaultLocked: boolean
  isActive: boolean
  onClick: () => void
  variant: 'sidebar' | 'mobile'
}

export function EntryNavItem({ entryId, index, isVaultLocked, isActive, onClick, variant }: EntryNavItemProps) {
  const { t } = useTranslation('entries')
  const { data: title } = useField(entryId, 'title')

  const label = isVaultLocked ? t('entryLabel', { number: index + 1 }) : title || t('entryLabel', { number: index + 1 })

  if (variant === 'mobile') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex flex-col items-center gap-0.5 px-2 py-1 text-xs',
          isActive ? 'bg-muted' : 'hover:bg-muted/50 text-muted-foreground',
        )}
      >
        <FileText className="size-5" />
        <span className="max-w-16 min-w-0 truncate text-[10px] leading-tight">{label}</span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none focus-visible:ring-2',
        isActive ? 'bg-muted font-medium' : 'hover:bg-muted/50 text-muted-foreground',
      )}
    >
      <FileText className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  )
}
