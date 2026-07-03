import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, KeyRound, ShieldCheck, ScanEye, Fingerprint, type LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { useChangePasswordDialogStore } from '@/shared/auth/change-password-dialog-store'
import { useRegenerateMnemonicDialogStore } from '@/shared/auth/regenerate-mnemonic-dialog-store'
import { useVerifyMnemonicDialogStore } from '@/shared/auth/verify-mnemonic-dialog-store'

const ITEMS: { icon: LucideIcon; labelKey: string; onClick?: () => void }[] = [
  {
    icon: KeyRound,
    labelKey: 'security.changePassword',
    onClick: () => useChangePasswordDialogStore.getState().openChangePasswordDialog(),
  },
  {
    icon: ShieldCheck,
    labelKey: 'security.seedPhrase',
    onClick: () => useRegenerateMnemonicDialogStore.getState().openRegenerateMnemonicDialog(),
  },
  {
    icon: ScanEye,
    labelKey: 'security.verifySeedPhrase',
    onClick: () => useVerifyMnemonicDialogStore.getState().openVerifyMnemonicDialog(),
  },
  { icon: Fingerprint, labelKey: 'security.keyVersions' },
]

function SecurityItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button
        type="button"
        className="hover:bg-muted/50 -mx-1 flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-2 text-left"
        onClick={onClick}
      >
        <span className="flex items-center gap-3 text-sm">
          <Icon className="size-4" />
          {label}
        </span>
        <ChevronRight className="text-muted-foreground size-4" />
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between py-2">
      <span className="flex items-center gap-3 text-sm">
        <Icon className="size-4" />
        {label}
      </span>
      <ChevronRight className="text-muted-foreground size-4" />
    </div>
  )
}

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
            <SecurityItem icon={item.icon} label={t(item.labelKey)} onClick={item.onClick} />
          </Fragment>
        ))}
      </CardContent>
    </Card>
  )
}

export { SecuritySection }
