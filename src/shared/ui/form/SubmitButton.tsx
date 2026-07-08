import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

interface SubmitButtonProps {
  isSubmitting: boolean
  submitLabel: string
  submittingLabel: string
  disabled?: boolean
  className?: string
  variant?: 'default' | 'destructive'
  /** Stable selector for E2E tests (rendered as `data-testid`). */
  dataTestId?: string
}

function SubmitButton({
  isSubmitting,
  submitLabel,
  submittingLabel,
  disabled,
  className,
  variant,
  dataTestId,
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      variant={variant ?? 'default'}
      className={cn('w-full', className)}
      disabled={isSubmitting || disabled}
      data-testid={dataTestId}
    >
      {isSubmitting && <Loader2 className="size-4 animate-spin" />}
      {isSubmitting ? submittingLabel : submitLabel}
    </Button>
  )
}

export { SubmitButton }
export type { SubmitButtonProps }
