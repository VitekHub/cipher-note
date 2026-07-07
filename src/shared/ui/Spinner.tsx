import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'size-3',
  md: 'size-4',
  lg: 'size-6',
}

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

/** Animated loading spinner. Wraps the lucide `Loader2` icon with a consistent size scale. */
function Spinner({ size = 'md', className }: SpinnerProps) {
  const { t } = useTranslation('common')
  return (
    <span role="status" aria-live="polite">
      <Loader2 className={cn('animate-spin', SIZE_CLASSES[size], className)} aria-hidden />
      <span className="sr-only">{t('status.loading')}</span>
    </span>
  )
}

export { Spinner }
export type { SpinnerProps, SpinnerSize }
