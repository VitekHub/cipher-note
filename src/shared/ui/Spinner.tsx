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
  return <Loader2 className={cn('animate-spin', SIZE_CLASSES[size], className)} aria-hidden />
}

export { Spinner }
export type { SpinnerProps, SpinnerSize }
