import { Fragment, useMemo } from 'react'
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

const AUTO_LOCK_MINUTES = [5, 10, 15, 30, 60] as const

function SecuritySection() {
  const { t } = useTranslation('settings')
  const vaultTimeoutMs = useVaultSettingsStore((s) => s.vaultTimeoutMs)
  const setVaultTimeoutMs = useVaultSettingsStore((s) => s.setVaultTimeoutMs)
  const lockOnTabHidden = useVaultSettingsStore((s) => s.lockOnTabHidden)
  const setLockOnTabHidden = useVaultSettingsStore((s) => s.setLockOnTabHidden)

  // Base UI SelectItem children are portal-mounted and not in the DOM while the
  // popup is closed, so SelectValue uses `items` to resolve the selected label.
  const autoLockItems = useMemo(
    () =>
      AUTO_LOCK_MINUTES.map((minutes) => ({
        value: String(minutes * 60 * 1000),
        label: t('security.minutesShort', { count: minutes }),
      })),
    [t],
  )

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
          <Select
            value={String(vaultTimeoutMs)}
            onValueChange={(v) => {
              const ms = Number(v)
              if (Number.isFinite(ms) && ms > 0) setVaultTimeoutMs(ms)
            }}
            items={autoLockItems}
          >
            <SelectTrigger aria-label={t('security.autoLock')} className="w-auto" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTO_LOCK_MINUTES.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes * 60 * 1000)}>
                  {t('security.minutesShort', { count: minutes })}
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
