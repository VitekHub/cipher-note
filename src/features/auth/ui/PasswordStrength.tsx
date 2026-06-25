import { useMemo, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverArrow, PopoverPortal, PopoverPositioner } from '@/shared/ui/popover'
import { calculateStrength, getStrengthLevel, testMinLength } from '@/shared/auth/password-utils'

function getBarColor(index: number, score: number, minLengthMet: boolean) {
  if (index > score) return 'bg-muted'
  const level = getStrengthLevel(score, minLengthMet)
  if (level === 'weak') return 'bg-destructive'
  if (level === 'fair') return 'bg-warning'
  return 'bg-primary'
}

function getLabelColor(level: 'weak' | 'fair' | 'strong') {
  if (level === 'weak') return 'text-destructive'
  if (level === 'fair') return 'text-warning'
  return 'text-primary'
}

interface PasswordStrengthProps {
  password: string
  anchorRef: RefObject<Element | null>
  container?: RefObject<HTMLElement | null>
}

function PasswordStrength({ password, anchorRef, container }: PasswordStrengthProps) {
  const { t } = useTranslation('auth')

  const { score, criteria } = useMemo(() => calculateStrength(password), [password])
  const minLengthMet = testMinLength(password)
  const level = getStrengthLevel(score, minLengthMet)

  return (
    <Popover open={password.length > 0}>
      <PopoverPortal container={container}>
        <PopoverPositioner anchor={anchorRef} side="right" sideOffset={12} align="center">
          <PopoverArrow />
          <div className="border-border bg-popover space-y-3 rounded-lg border p-3 shadow-md">
            <p className={cn('text-sm font-medium', getLabelColor(level))}>{t(`passwordStrength.${level}`)}</p>
            <div className="flex gap-1">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  data-testid="strength-bar"
                  className={cn('h-1.5 flex-1 rounded-full transition-colors', getBarColor(i + 1, score, minLengthMet))}
                />
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{t('passwordStrength.requirements')}</p>
            <ul className="text-muted-foreground space-y-0.5 text-xs">
              {criteria.map((c) => (
                <li key={c.key} className={cn('flex items-center gap-1.5', c.met && 'text-primary')}>
                  {c.met ? <Check className="size-3" /> : <X className="size-3" />}
                  {t(`passwordStrength.criteria.${c.key}`)}
                </li>
              ))}
            </ul>
          </div>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  )
}

export { PasswordStrength }
