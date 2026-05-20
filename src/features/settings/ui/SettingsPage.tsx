import { useTranslation } from 'react-i18next'

import { SecuritySection } from '@/features/settings/ui/SecuritySection'
import { PreferencesSection } from '@/features/settings/ui/PreferencesSection'
import { AccountSection } from '@/features/settings/ui/AccountSection'

function SettingsPage() {
  const { t } = useTranslation('settings')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-balance">{t('title')}</h1>
      <div className="max-w-lg space-y-6">
        <SecuritySection />
        <PreferencesSection />
        <AccountSection />
      </div>
    </div>
  )
}

export { SettingsPage }
