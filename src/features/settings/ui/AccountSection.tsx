import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'

import { useCurrentUser } from '@/shared/auth/use-current-user'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'

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
          <span className="text-muted-foreground text-sm">{t('account.username')}</span>
          <span className="text-sm font-medium">{user?.username ?? '—'}</span>
        </div>
        <Separator />
        <Button variant="destructive" disabled className="mt-4 self-start">
          <Trash2 className="size-4" />
          {t('account.deleteAccount')}
        </Button>
      </CardContent>
    </Card>
  )
}

export { AccountSection }
