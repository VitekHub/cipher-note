import { useTranslation } from 'react-i18next'

import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/shared/crypto/vault-dialog-store'
import { FieldCard } from '@/features/fields/ui/FieldCard'
import { NoteField } from '@/features/fields/ui/NoteField'
import { WebsiteField } from '@/features/fields/ui/WebsiteField'
import { EmailField } from '@/features/fields/ui/EmailField'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { ReactNode } from 'react'

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
  const openUnlockDialog = useVaultDialogStore((s) => s.openUnlockDialog)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-balance">{t('nav.dashboard')}</h1>
      <div className="grid gap-4 *:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
        {FIELD_NAMES.map((fieldName, index) => (
          <FieldCard
            key={fieldName}
            fieldName={fieldName}
            isLocked={isVaultLocked}
            onUnlock={isVaultLocked ? openUnlockDialog : undefined}
            entranceIndex={index}
          >
            {() => getFieldEditor(fieldName)}
          </FieldCard>
        ))}
      </div>
    </div>
  )
}

export { DashboardPage }
