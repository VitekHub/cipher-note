import { useTranslation } from 'react-i18next'

import { Input } from '@/shared/ui/input'

interface EmailFieldProps {
  value: string
  onChange: (value: string) => void
}

function EmailField({ value, onChange }: EmailFieldProps) {
  const { t } = useTranslation('fields')

  return (
    <Input
      type="email"
      autoComplete="email"
      aria-label={t('email.label')}
      spellCheck={false}
      placeholder={t('email.placeholder')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export { EmailField }
