import { useTranslation } from 'react-i18next'

import { Input } from '@/shared/ui/input'

interface WebsiteFieldProps {
  value: string
  onChange: (value: string) => void
}

function WebsiteField({ value, onChange }: WebsiteFieldProps) {
  const { t } = useTranslation('fields')

  return (
    <Input
      type="url"
      autoComplete="url"
      aria-label={t('website.label')}
      spellCheck={false}
      placeholder={t('website.placeholder')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export { WebsiteField }
