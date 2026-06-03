import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/shared/crypto/vault-dialog-store'
import { useSyncStatusStore } from '@/features/fields/model/sync-status-store'
import { useFieldEditor } from '@/features/fields/model/use-field-editor'
import { FieldCard } from '@/features/fields/ui/FieldCard'
import { NoteField } from '@/features/fields/ui/NoteField'
import { WebsiteField } from '@/features/fields/ui/WebsiteField'
import { EmailField } from '@/features/fields/ui/EmailField'
import { SaveIndicator } from '@/features/fields/ui/SaveIndicator'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'
import type { FieldName } from '@/shared/types/entities/field.types'

function FieldEditorWrapper({ fieldName }: { fieldName: FieldName }) {
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const openUnlockDialog = useVaultDialogStore((s) => s.openUnlockDialog)
  const { fieldValue, saveFieldValue, fieldSyncStatus, retrySave } = useFieldEditor(fieldName)

  return (
    <FieldCard
      fieldName={fieldName}
      isLocked={isVaultLocked}
      onUnlock={isVaultLocked ? openUnlockDialog : undefined}
      statusIndicator={
        <SaveIndicator status={fieldSyncStatus} onRetry={fieldSyncStatus === 'error' ? retrySave : undefined} />
      }
    >
      {() => {
        switch (fieldName) {
          case 'note':
            return <NoteField value={fieldValue} onChange={saveFieldValue} />
          case 'website':
            return <WebsiteField value={fieldValue} onChange={saveFieldValue} />
          case 'email':
            return <EmailField value={fieldValue} onChange={saveFieldValue} />
        }
      }}
    </FieldCard>
  )
}

function DashboardPage() {
  const { t } = useTranslation('common')
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const resetAllSyncStatus = useSyncStatusStore((s) => s.resetAll)

  // Reset sync status when vault locks
  useEffect(() => {
    if (isVaultLocked) {
      resetAllSyncStatus()
    }
  }, [isVaultLocked, resetAllSyncStatus])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-balance">{t('nav.dashboard')}</h1>
      <div className="grid gap-4 *:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
        {FIELD_NAMES.map((fieldName) => (
          <FieldEditorWrapper key={fieldName} fieldName={fieldName} />
        ))}
      </div>
    </div>
  )
}

export { DashboardPage }
