import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

interface SubmitButtonProps {
  isSubmitting: boolean
  submitLabel: string
  submittingLabel: string
  disabled?: boolean
  className?: string
}

function SubmitButton({ isSubmitting, submitLabel, submittingLabel, disabled, className }: SubmitButtonProps) {
  return (
    <Button type="submit" className={cn('w-full', className)} disabled={isSubmitting || disabled}>
      {isSubmitting && <Loader2 className="size-4 animate-spin" />}
      {isSubmitting ? submittingLabel : submitLabel}
    </Button>
  )
}

export { SubmitButton }
export type { SubmitButtonProps }
