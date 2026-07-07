import { ChevronRight, type LucideIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

interface SettingsItemProps {
  icon: LucideIcon
  label: string
  testId?: string
  onClick?: () => void
  variant?: 'default' | 'destructive'
}

function SettingsItem({ icon: Icon, label, testId, onClick, variant = 'default' }: SettingsItemProps) {
  const isDestructive = variant === 'destructive'

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(
          'hover:bg-muted/50 -mx-1 flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-2 text-left',
          isDestructive && 'text-destructive hover:bg-destructive/10',
        )}
        data-testid={testId}
        onClick={onClick}
      >
        <span className="flex items-center gap-3 text-sm">
          <Icon className="size-4" />
          {label}
        </span>
        <ChevronRight className="text-muted-foreground size-4" />
      </button>
    )
  }

  return (
    <div className={cn('flex items-center justify-between py-2 opacity-50', isDestructive && 'text-destructive')}>
      <span className="flex items-center gap-3 text-sm">
        <Icon className="size-4" />
        {label}
      </span>
    </div>
  )
}

export { SettingsItem }
export type { SettingsItemProps }
