import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/shared/ui/card'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { ReactNode } from 'react'

// Static keys so i18next-parser can discover them (template literals would not be scanned)
const FIELD_I18N_KEYS: Record<FieldName, { label: string; locked: string; unlock: string }> = {
  note: { label: 'note.label', locked: 'note.locked', unlock: 'note.unlock' },
  website: { label: 'website.label', locked: 'website.locked', unlock: 'website.unlock' },
  email: { label: 'email.label', locked: 'email.locked', unlock: 'email.unlock' },
}

// Render function avoids creating editor components when vault is locked
interface FieldCardProps {
  fieldName: FieldName
  isLocked: boolean
  children: () => ReactNode
  onUnlock?: () => void
  entranceIndex?: number
}

function FieldCard({ fieldName, isLocked, children, onUnlock, entranceIndex }: FieldCardProps) {
  const { t } = useTranslation('fields')
  const keys = FIELD_I18N_KEYS[fieldName]

  return (
    <Card
      size="sm"
      className={entranceIndex != null ? 'animate-fade-in-up' : undefined}
      style={entranceIndex != null ? { animationDelay: `${entranceIndex * 75}ms` } : undefined}
    >
      <CardHeader>
        <CardTitle>{t(keys.label)}</CardTitle>
        {isLocked && (
          <CardAction>
            <Lock className="text-muted-foreground size-4" />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isLocked ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Lock className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">{t(keys.locked)}</p>
            {onUnlock && (
              <Button variant="outline" size="sm" onClick={onUnlock}>
                {t(keys.unlock)}
              </Button>
            )}
          </div>
        ) : (
          children()
        )}
      </CardContent>
    </Card>
  )
}

export { FieldCard }
