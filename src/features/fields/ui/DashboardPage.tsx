import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useSyncStatusStore } from '@/features/fields/model/sync-status-store'
import { useFieldEditor } from '@/features/fields/model/use-field-editor'
import { FieldCard } from '@/features/fields/ui/FieldCard'
import { NoteField } from '@/features/fields/ui/NoteField'
import { InputField } from '@/features/fields/ui/InputField'
import { LockedVaultCard } from '@/features/fields/ui/LockedVaultCard'
import { SaveIndicator } from '@/features/fields/ui/SaveIndicator'
import { DeleteEntryDialog } from '@/features/fields/ui/DeleteEntryDialog'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import type { FieldName } from '@/shared/types/entities/field.types'

function FieldEditorWrapper({
  entryId,
  fieldName,
  entranceIndex,
}: {
  entryId: string
  fieldName: FieldName
  entranceIndex: number
}) {
  const { fieldValue, saveFieldValue, fieldSyncStatus, retrySave, isOfflineAwaitingData } = useFieldEditor(
    entryId,
    fieldName,
  )

  return (
    <FieldCard
      fieldName={fieldName}
      isOfflineAwaitingData={isOfflineAwaitingData}
      entranceIndex={entranceIndex}
      statusIndicator={
        <SaveIndicator status={fieldSyncStatus} onRetry={fieldSyncStatus === 'error' ? retrySave : undefined} />
      }
    >
      {() => {
        switch (fieldName) {
          case 'title':
            return <InputField fieldName="title" value={fieldValue} onChange={saveFieldValue} />
          case 'note':
            return <NoteField value={fieldValue} onChange={saveFieldValue} />
          case 'website':
            return <InputField fieldName="website" value={fieldValue} onChange={saveFieldValue} />
          case 'email':
            return <InputField fieldName="email" value={fieldValue} onChange={saveFieldValue} />
        }
      }}
    </FieldCard>
  )
}

function EntryDetailPage({ entryId }: { entryId: string }) {
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const resetAllSyncStatus = useSyncStatusStore((s) => s.resetAll)

  // Reset sync status when switching entries
  useEffect(() => {
    resetAllSyncStatus()
  }, [entryId, resetAllSyncStatus])

  if (isVaultLocked) {
    return <LockedVaultCard />
  }

  return (
    <div>
      {/* Delete entry */}
      <div className="mb-2 flex justify-end">
        <DeleteEntryDialog entryId={entryId} />
      </div>
      <div className="space-y-6">
        <FieldEditorWrapper entryId={entryId} fieldName="title" entranceIndex={0} />
        <div className="grid gap-4 *:min-w-0 sm:grid-cols-2">
          <FieldEditorWrapper entryId={entryId} fieldName="website" entranceIndex={1} />
          <FieldEditorWrapper entryId={entryId} fieldName="email" entranceIndex={2} />
        </div>
        <FieldEditorWrapper entryId={entryId} fieldName="note" entranceIndex={3} />
      </div>
    </div>
  )
}

/** Empty state shown when user has no entries. */
function EmptyState({ onCreateEntry }: { onCreateEntry: () => void }) {
  const { t } = useTranslation('common')
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)

  if (isVaultLocked) {
    return <LockedVaultCard />
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center">
      <Card size="sm" className="max-w-sm">
        <CardHeader>
          <CardTitle>{t('entries.empty')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={onCreateEntry} className="my-4 w-full">
            <Plus className="mr-2 size-4" />
            {t('entries.emptyAction')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export { EntryDetailPage, EmptyState }
