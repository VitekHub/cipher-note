import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/shared/ui/card'
import type { FieldName } from '@/shared/types/entities/field.types'

interface FieldCardProps {
  fieldName: FieldName
  isLocked: boolean
  children: ReactNode
  onUnlock?: () => void
}

function FieldCard({ fieldName, isLocked, children, onUnlock }: FieldCardProps) {
  const { t } = useTranslation('fields')

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t(`${fieldName}.label`)}</CardTitle>
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
            <p className="text-muted-foreground text-sm">{t(`${fieldName}.locked`)}</p>
            {onUnlock && (
              <Button variant="outline" size="sm" onClick={onUnlock}>
                {t(`${fieldName}.unlock`)}
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export { FieldCard }
