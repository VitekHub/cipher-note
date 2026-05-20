import { useTranslation } from 'react-i18next'

import { Input } from '@/shared/ui/input'

function WebsiteField() {
  const { t } = useTranslation('fields')

  return <Input type="url" autoComplete="url" placeholder={t('website.placeholder')} />
}

export { WebsiteField }
