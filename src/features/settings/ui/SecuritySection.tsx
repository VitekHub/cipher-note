import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, KeyRound, ShieldCheck, Fingerprint, type LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'

const ITEMS: { icon: LucideIcon; labelKey: string }[] = [
  { icon: KeyRound, labelKey: 'security.changePassword' },
  { icon: ShieldCheck, labelKey: 'security.seedPhrase' },
  { icon: Fingerprint, labelKey: 'security.keyVersions' },
]

function SecurityItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
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
            <SecurityItem icon={item.icon} label={t(item.labelKey)} />
          </Fragment>
        ))}
      </CardContent>
    </Card>
  )
}

export { SecuritySection }
