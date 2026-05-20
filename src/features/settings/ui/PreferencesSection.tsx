import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { LanguageSwitcher } from '@/shared/ui/nav/LanguageSwitcher'

function PreferencesSection() {
  const { t } = useTranslation('settings')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('preferences.title')}</CardTitle>
        <CardDescription>{t('preferences.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm">{t('preferences.language')}</span>
          <LanguageSwitcher variant="full" />
        </div>
      </CardContent>
    </Card>
  )
}

export { PreferencesSection }
