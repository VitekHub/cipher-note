import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface CriterionResult {
  key: string
  met: boolean
}

interface StrengthResult {
  score: number
  criteria: CriterionResult[]
}

const CRITERIA_CONFIG = [
  { key: 'minLength', test: (p: string) => p.length >= 8 },
  { key: 'maxLength', test: (p: string) => p.length >= 12 },
  { key: 'uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lowercase', test: (p: string) => /[a-z]/.test(p) },
  { key: 'digitOrSpecial', test: (p: string) => /[\d\W_]/.test(p) },
] as const

function calculateStrength(password: string): StrengthResult {
  const criteria = CRITERIA_CONFIG.map(({ key, test }) => ({ key, met: test(password) }))
  const score = criteria.filter((c) => c.met).length
  return { score, criteria }
}

function getStrengthLevel(score: number) {
  if (score <= 1) return 'weak' as const
  if (score <= 3) return 'fair' as const
  return 'strong' as const
}

function getBarColor(index: number, score: number) {
  if (index > score) return 'bg-muted'
  const level = getStrengthLevel(score)
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
}

function PasswordStrength({ password }: PasswordStrengthProps) {
  const { t } = useTranslation('auth')
  const { score, criteria } = calculateStrength(password)
  const level = getStrengthLevel(score)

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', getBarColor(i + 1, score))} />
        ))}
      </div>
      <p className={cn('text-sm font-medium', getLabelColor(level))}>{t(`passwordStrength.${level}`)}</p>
      <ul className="text-muted-foreground space-y-0.5 text-xs">
        {criteria.map((c) => (
          <li key={c.key} className={cn('flex items-center gap-1.5', c.met && 'text-primary')}>
            {c.met ? <Check className="size-3" /> : <X className="size-3" />}
            {t(`passwordStrength.criteria.${c.key}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}

export { PasswordStrength }
