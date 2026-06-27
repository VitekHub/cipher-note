import { useState, useEffect, useCallback } from 'react'
import { useField } from '@/features/fields/model/use-field'
import { useSaveField } from '@/features/fields/model/use-field'
import { useSyncStatusStore, useFieldSyncStatus, SYNC_STATUS } from '@/features/fields/model/sync-status-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
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
  const fieldQuery = useField(entryId, fieldName)
  const saveMutation = useSaveField(entryId, fieldName)
  const setSyncStatus = useSyncStatusStore((s) => s.setStatus)
  const syncStatus = useFieldSyncStatus(entryId, fieldName)
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
    if (syncStatus === SYNC_STATUS.SAVED) {
      setDraft(null)
    }
  }

  // Reset stale "saved" status on mount
  useEffect(() => {
    // Read store directly (not via selector). We only want to reset stale
    // status on mount, not re-render every time any field's status changes.
    if (useSyncStatusStore.getState().status[entryId]?.[fieldName] === SYNC_STATUS.SAVED) {
      setSyncStatus(entryId, fieldName, SYNC_STATUS.IDLE)
    }
  }, [entryId, fieldName, setSyncStatus])

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
    saveMutation.isPaused && syncStatus === SYNC_STATUS.SAVING
      ? SYNC_STATUS.PAUSED
      : !saveMutation.isPaused && syncStatus === SYNC_STATUS.PAUSED
        ? SYNC_STATUS.SAVING
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
