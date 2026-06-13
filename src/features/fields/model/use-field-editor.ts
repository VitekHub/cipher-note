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
  isOfflineAwaitingData: boolean
}

/**
 * Field editor hook for encrypted fields.
 *
 * Manages a local draft that takes priority over query data while editing,
 * debounces saves (1s after last keystroke), and tracks sync status.
 */
function useFieldEditor(entryId: string, fieldName: FieldName): UseFieldEditorResult {
  const fieldQuery = useFieldQuery(entryId, fieldName)
  const saveMutation = useFieldMutation(entryId, fieldName)
  const setSyncStatus = useSyncStatusStore((s) => s.setStatus)
  const syncStatus = useSyncStatusStore((s) => s.status[fieldName])
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)

  // Local draft for optimistic editing.
  // - null: not editing → display server data (fieldQuery.data)
  // - non-null: user is typing → display draft (overrides server data)
  // Cleared on successful save or vault lock.
  const [draft, setDraft] = useState<string | null>(null)

  // Clear draft when vault locks or save succeeds (derive resets during render)
  const [prevIsVaultLocked, setPrevIsVaultLocked] = useState(isVaultLocked)
  const [prevSyncStatus, setPrevSyncStatus] = useState(syncStatus)
  if (isVaultLocked !== prevIsVaultLocked) {
    setPrevIsVaultLocked(isVaultLocked)
    if (isVaultLocked) {
      setDraft(null)
    }
  }
  if (syncStatus !== prevSyncStatus) {
    setPrevSyncStatus(syncStatus)
    if (syncStatus === 'saved') {
      setDraft(null)
    }
  }

  // Reset stale "saved" status on mount
  useEffect(() => {
    if (useSyncStatusStore.getState().status[fieldName] === 'saved') {
      setSyncStatus(fieldName, 'idle')
    }
  }, [fieldName, setSyncStatus])

  const { debounceSave, retrySave } = useSaveScheduler({
    entryId,
    fieldName,
    setSyncStatus,
    saveMutate: saveMutation.mutate,
    isVaultLocked,
  })

  // Derive effective sync status from mutation pause state:
  // When offline, TanStack Query pauses the mutation - reflect this in the UI
  // by deriving 'paused' during render rather than syncing via effect.
  const effectiveSyncStatus: SyncStatus =
    saveMutation.isPaused && syncStatus === 'saving'
      ? 'paused'
      : !saveMutation.isPaused && syncStatus === 'paused'
        ? 'saving'
        : syncStatus

  const saveFieldValue = useCallback(
    (value: string) => {
      setDraft(value)
      debounceSave(value)
    },
    [debounceSave],
  )

  // FieldValue resolution: draft takes priority while editing, otherwise query data.
  const fieldValue = isVaultLocked ? '' : (draft ?? fieldQuery.data ?? '')
  const isOfflineAwaitingData = fieldQuery.isPaused && !fieldQuery.data

  return { fieldValue, saveFieldValue, fieldSyncStatus: effectiveSyncStatus, retrySave, isOfflineAwaitingData }
}

export { useFieldEditor }
