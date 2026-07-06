import { useTranslation } from 'react-i18next'
import { KeyRound, Trash2, User } from 'lucide-react'

import { useCurrentUser } from '@/shared/auth/use-current-user'
import { useChangePasswordDialogStore } from '@/shared/auth/auth-dialogs-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { SettingsItem } from '@/features/settings/ui/SettingsItem'

function AccountSection() {
  const { t } = useTranslation('settings')
  const user = useCurrentUser()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('account.title')}</CardTitle>
        <CardDescription>{t('account.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        <div className="flex items-center justify-between py-2">
          <span className="flex items-center gap-3 text-sm">
            <User className="size-4" />
            {t('account.username')}
          </span>
          <span className="text-sm font-medium">{user?.username ?? '—'}</span>
        </div>
        <Separator />
        <SettingsItem
          icon={KeyRound}
          label={t('account.changePassword')}
          onClick={() => useChangePasswordDialogStore.getState().open()}
        />
        <Separator />
        <SettingsItem icon={Trash2} label={t('account.deleteAccount')} variant="destructive" />
      </CardContent>
    </Card>
  )
}

export { AccountSection }
