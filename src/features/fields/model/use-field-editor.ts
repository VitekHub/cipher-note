import { useState, useEffect, useCallback } from 'react'
import { useFieldQuery } from '@/features/fields/model/use-field-query'
import { useFieldMutation } from '@/features/fields/model/use-field-mutation'
import { useSyncStatusStore } from '@/features/fields/model/sync-status-store'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useSaveScheduler } from '@/features/fields/model/use-save-scheduler'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { SyncStatus } from '@/features/fields/model/sync-status-store'

export interface UseFieldEditorResult {
  fieldValue: string
  saveFieldValue: (value: string) => void
  fieldSyncStatus: SyncStatus
  retrySave: () => void
}

/**
 * Field editor hook for encrypted fields.
 *
 * Manages a local draft that takes priority over query data while editing,
 * debounces saves (1s after last keystroke), and tracks sync status.
 */
function useFieldEditor(fieldName: FieldName): UseFieldEditorResult {
  const fieldQuery = useFieldQuery(fieldName)
  const saveMutation = useFieldMutation(fieldName)
  const setSyncStatus = useSyncStatusStore((s) => s.setStatus)
  const syncStatus = useSyncStatusStore((s) => s.status[fieldName])
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)

  // Local draft for optimistic editing.
  // - null: not editing → display server data (fieldQuery.data)
  // - non-null: user is typing → display draft (overrides server data)
  // Cleared on successful save, vault lock, or component unmount.
  const [draft, setDraft] = useState<string | null>(null)

  // Reset draft when vault locks (synchronous render-phase update)
  const [prevIsVaultLocked, setPrevIsVaultLocked] = useState(isVaultLocked)
  if (isVaultLocked !== prevIsVaultLocked) {
    setPrevIsVaultLocked(isVaultLocked)
    if (isVaultLocked) {
      setDraft(null)
    }
  }

  // Reset stale "saved" status on mount
  useEffect(() => {
    if (useSyncStatusStore.getState().status[fieldName] === 'saved') {
      setSyncStatus(fieldName, 'idle')
    }
  }, [fieldName, setSyncStatus])

  const { debounceSave, retrySave } = useSaveScheduler(fieldName, setSyncStatus, saveMutation.mutate, isVaultLocked)

  // Auto-retry when the browser regains connectivity - listener is always
  // registered; the handler checks status imperatively to avoid add/remove churn.
  useEffect(() => {
    const handleOnline = () => {
      if (useSyncStatusStore.getState().status[fieldName] === 'error') {
        retrySave()
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [fieldName, retrySave])

  const saveFieldValue = useCallback(
    (value: string) => {
      setDraft(value)
      debounceSave(value)
    },
    [debounceSave],
  )

  // FieldValue resolution: draft takes priority while editing, otherwise query data.
  const fieldValue = isVaultLocked ? '' : (draft ?? fieldQuery.data ?? '')

  return { fieldValue, saveFieldValue, fieldSyncStatus: syncStatus, retrySave }
}

export { useFieldEditor }
