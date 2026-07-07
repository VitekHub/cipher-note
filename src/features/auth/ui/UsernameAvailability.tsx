import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { Spinner } from '@/shared/ui/Spinner'
import { cn } from '@/shared/lib/utils'
import type { UsernameAvailabilityStatus } from '@/features/auth/model/use-username-availability'

interface UsernameAvailabilityProps {
  status: UsernameAvailabilityStatus
}

function UsernameAvailability({ status }: UsernameAvailabilityProps) {
  const { t } = useTranslation('auth')

  if (status === 'idle') return null

  return (
    <p
      className={cn(
        'mt-1 flex items-center gap-1 text-xs',
        status === 'available' && 'text-primary',
        status === 'taken' && 'text-destructive',
        status === 'error' && 'text-muted-foreground',
        status === 'checking' && 'text-muted-foreground',
      )}
    >
      {status === 'checking' && <Spinner size="sm" />}
      {status === 'available' && <Check className="size-3" />}
      {status === 'taken' && <X className="size-3" />}
      {status === 'checking' && t('register.checkingUsername')}
      {status === 'available' && t('register.usernameAvailable')}
      {status === 'taken' && t('register.usernameTaken')}
      {status === 'error' && t('register.usernameCheckError')}
    </p>
  )
}

export { UsernameAvailability }
