import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import { CardSkeleton } from '@/shared/ui/CardSkeleton'
import { AccountSection } from '@/features/settings/ui/AccountSection'
import { PreferencesSection } from '@/features/settings/ui/PreferencesSection'
import { SecuritySection } from '@/features/settings/ui/SecuritySection'
import { AboutSection } from '@/features/settings/ui/AboutSection'

const SessionSection = lazy(() =>
  import('@/features/settings/ui/SessionSection').then((m) => ({ default: m.SessionSection })),
)

function SettingsPage() {
  const { t } = useTranslation('settings')

  return (
    <div className="@container space-y-6">
      <h1 className="text-2xl font-bold text-balance">{t('title')}</h1>
      <div className="grid max-w-3xl grid-cols-1 gap-6 @[700px]:grid-cols-2">
        <AccountSection />
        <PreferencesSection />
        <SecuritySection />
        <AboutSection />
      </div>
      <div className="max-w-3xl">
        <Suspense fallback={<CardSkeleton />}>
          <SessionSection />
        </Suspense>
      </div>
    </div>
  )
}

export { SettingsPage }
