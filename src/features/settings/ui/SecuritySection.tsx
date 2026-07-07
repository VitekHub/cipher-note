import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ScanEye, type LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { useRegenerateMnemonicDialogStore, useVerifyMnemonicDialogStore } from '@/shared/auth/auth-dialogs-store'
import { SettingsItem } from '@/features/settings/ui/SettingsItem'
import { KeyManagementSubsection } from '@/features/settings/ui/KeyManagementSubsection'

const ITEMS: { icon: LucideIcon; labelKey: string; onClick?: () => void }[] = [
  {
    icon: ShieldCheck,
    labelKey: 'security.seedPhrase',
    onClick: () => useRegenerateMnemonicDialogStore.getState().open(),
  },
  {
    icon: ScanEye,
    labelKey: 'security.verifySeedPhrase',
    onClick: () => useVerifyMnemonicDialogStore.getState().open(),
  },
]

function SecuritySection() {
  const { t } = useTranslation('settings')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('security.title')}</CardTitle>
        <CardDescription>{t('security.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {ITEMS.map((item, i) => (
          <Fragment key={item.labelKey}>
            {i > 0 && <Separator />}
            <SettingsItem icon={item.icon} label={t(item.labelKey)} onClick={item.onClick} />
          </Fragment>
        ))}
        <Separator />
        <KeyManagementSubsection />
      </CardContent>
    </Card>
  )
}

export { SecuritySection }
