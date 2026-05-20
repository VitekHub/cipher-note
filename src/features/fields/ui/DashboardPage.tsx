import { useTranslation } from 'react-i18next'

import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { FieldCard } from '@/features/fields/ui/FieldCard'
import { NoteField } from '@/features/fields/ui/NoteField'
import { WebsiteField } from '@/features/fields/ui/WebsiteField'
import { EmailField } from '@/features/fields/ui/EmailField'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { ReactNode } from 'react'

const FIELD_NAMES: FieldName[] = ['note', 'website', 'email']

function getFieldEditor(fieldName: FieldName): ReactNode {
  switch (fieldName) {
    case 'note':
      return <NoteField />
    case 'website':
      return <WebsiteField />
    case 'email':
      return <EmailField />
  }
}

function DashboardPage() {
  const { t } = useTranslation('common')
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-balance">{t('nav.dashboard')}</h1>
      <div className="grid gap-4 *:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
        {FIELD_NAMES.map((fieldName) => (
          <FieldCard key={fieldName} fieldName={fieldName} isLocked={isVaultLocked}>
            {() => getFieldEditor(fieldName)}
          </FieldCard>
        ))}
      </div>
    </div>
  )
}

export { DashboardPage }
