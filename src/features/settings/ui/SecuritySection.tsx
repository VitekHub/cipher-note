import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ScanEye, Timer, EyeOff, type LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { useRegenerateMnemonicDialogStore, useVerifyMnemonicDialogStore } from '@/shared/stores/dialogs-store'
import { SettingsItem } from '@/features/settings/ui/SettingsItem'
import { Checkbox } from '@/shared/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useVaultSettingsStore } from '@/shared/stores/vault-settings-store'
import { KeyManagementSubsection } from '@/features/settings/ui/KeyManagementSubsection'

const ITEMS: { icon: LucideIcon; labelKey: string; onClick?: () => void }[] = [
  {
    icon: ScanEye,
    labelKey: 'security.verifySeedPhrase',
    onClick: () => useVerifyMnemonicDialogStore.getState().open(),
  },
  {
    icon: ShieldCheck,
    labelKey: 'security.seedPhrase',
    onClick: () => useRegenerateMnemonicDialogStore.getState().open(),
  },
]

const AUTO_LOCK_OPTIONS = [
  { value: 5 * 60 * 1000, minutes: 5 },
  { value: 10 * 60 * 1000, minutes: 10 },
  { value: 15 * 60 * 1000, minutes: 15 },
  { value: 30 * 60 * 1000, minutes: 30 },
  { value: 60 * 60 * 1000, minutes: 60 },
] as const

function SecuritySection() {
  const { t } = useTranslation('settings')
  const vaultTimeoutMs = useVaultSettingsStore((s) => s.vaultTimeoutMs)
  const setVaultTimeoutMs = useVaultSettingsStore((s) => s.setVaultTimeoutMs)
  const lockOnTabHidden = useVaultSettingsStore((s) => s.lockOnTabHidden)
  const setLockOnTabHidden = useVaultSettingsStore((s) => s.setLockOnTabHidden)

  const autoLockItems = AUTO_LOCK_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t('security.minutesShort', { count: opt.minutes }),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('security.title')}</CardTitle>
        <CardDescription>{t('security.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        <div className="flex items-center justify-between py-2">
          <span className="flex items-center gap-3 text-sm">
            <Timer className="size-4" />
            {t('security.autoLock')}
          </span>
          <Select value={vaultTimeoutMs} onValueChange={(v) => setVaultTimeoutMs(Number(v))} items={autoLockItems}>
            <SelectTrigger aria-label={t('security.autoLock')} className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTO_LOCK_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t('security.minutesShort', { count: opt.minutes })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <label className="flex cursor-pointer items-center justify-between py-2">
          <span className="flex items-center gap-3 text-sm">
            <EyeOff className="size-4" />
            {t('security.lockOnTabHidden')}
          </span>
          <Checkbox
            checked={lockOnTabHidden}
            onCheckedChange={(checked) => setLockOnTabHidden(checked === true)}
            aria-label={t('security.lockOnTabHidden')}
          />
        </label>

        <Separator />

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
