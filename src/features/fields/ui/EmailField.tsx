import { useTranslation } from 'react-i18next'

import { Input } from '@/shared/ui/input'

function EmailField() {
  const { t } = useTranslation('fields')

  return <Input type="email" autoComplete="email" placeholder={t('email.placeholder')} />
}

export { EmailField }
