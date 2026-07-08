import { useTranslation } from 'react-i18next'
import { CloudOff } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/shared/ui/card'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { ReactNode } from 'react'

// Static keys so i18next-parser can discover them (template literals would not be scanned)
const FIELD_LABEL_KEYS: Record<FieldName, string> = {
  title: 'title.label',
  note: 'note.label',
  website: 'website.label',
  email: 'email.label',
}

interface FieldCardProps {
  fieldName: FieldName
  isOfflineAwaitingData: boolean
  children: () => ReactNode
  statusIndicator?: ReactNode
  entranceIndex?: number
}

function FieldCard({ fieldName, children, statusIndicator, entranceIndex, isOfflineAwaitingData }: FieldCardProps) {
  const { t } = useTranslation('fields')

  return (
    <Card
      size="sm"
      className={entranceIndex != null ? 'animate-fade-in-up' : undefined}
      style={entranceIndex != null ? { animationDelay: `${entranceIndex * 75}ms` } : undefined}
      data-testid={`field-card-${fieldName}`}
    >
      <CardHeader>
        <CardTitle>{t(FIELD_LABEL_KEYS[fieldName])}</CardTitle>
        <CardAction>{statusIndicator}</CardAction>
      </CardHeader>
      <CardContent>
        {isOfflineAwaitingData ? (
          <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-lg py-4">
            <div className="bg-primary/5 absolute inset-0 [mask:radial-gradient(circle_at_center,black_60%,transparent_100%)]" />
            <CloudOff className="text-muted-foreground/60 relative size-8" />
            <p className="text-muted-foreground relative text-sm">{t('offlineAwaitingData')}</p>
          </div>
        ) : (
          children()
        )}
      </CardContent>
    </Card>
  )
}

export { FieldCard }
