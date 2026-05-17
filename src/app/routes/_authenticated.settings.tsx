import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

function SettingsPage() {
  const { t } = useTranslation('settings')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title', 'Settings')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('security.title', 'Security')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t('security.description', 'Manage your password and security settings.')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.title', 'Preferences')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t('preferences.description', 'Language and display preferences.')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('account.title', 'Account')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('account.description', 'Manage your account settings.')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

export { Route }
