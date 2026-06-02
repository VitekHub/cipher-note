import { useState, useRef, useEffect, useCallback } from 'react'
import { useField } from '@/features/fields/model/use-field'
import { useSaveField } from '@/features/fields/model/use-save-field'
import { useSyncStatusStore } from '@/features/fields/model/sync-status'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { SyncStatus } from '@/features/fields/model/sync-status'

const DEBOUNCE_MS = 1000
const SAVED_DISPLAY_MS = 3000

export interface UseAutoSaveResult {
  value: string
  setValue: (value: string) => void
  syncStatus: SyncStatus
  retry: () => void
}

/**
 * Auto-save hook for encrypted fields.
 *
 * Manages a local draft that takes priority over query data while editing,
 * debounces saves (4s after last keystroke), and tracks sync status.
 */
function useAutoSave(fieldName: FieldName): UseAutoSaveResult {
  const fieldQuery = useField(fieldName)
  const saveMutation = useSaveField(fieldName)
  const setStatus = useSyncStatusStore((s) => s.setStatus)
  const getStatus = useSyncStatusStore((s) => s.status[fieldName])
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)

  // Reset stale "saved" status on mount
  useEffect(() => {
    if (useSyncStatusStore.getState().status[fieldName] === 'saved') {
      setStatus(fieldName, 'idle')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- intentional mount-only

  // Local draft: null means "not yet initialized from query data"
  const [draft, setDraft] = useState<string | null>(null)
  const isEditingRef = useRef(false)
  const latestValueRef = useRef('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref to avoid stale closures in setTimeout callbacks
  const mutateRef = useRef(saveMutation.mutate)

  // Keep mutateRef in sync with the latest mutation function
  useEffect(() => {
    mutateRef.current = saveMutation.mutate
  }, [saveMutation.mutate])

  // When vault locks, clear timers and reset editing state (no setState — just refs/timers)
  useEffect(() => {
    if (isVaultLocked) {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current)
        savedTimerRef.current = null
      }
      isEditingRef.current = false
    }
  }, [isVaultLocked])

  // Initialize draft from query data when not editing
  useEffect(() => {
    if (!isEditingRef.current && fieldQuery.data !== undefined) {
      setDraft(fieldQuery.data ?? '')
    }
  }, [fieldQuery.data])

  // Track mutation success/error for sync status
  useEffect(() => {
    if (saveMutation.isSuccess) {
      setStatus(fieldName, 'saved')
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current)
      }
      savedTimerRef.current = setTimeout(() => {
        const current = useSyncStatusStore.getState().status[fieldName]
        if (current === 'saved') {
          setStatus(fieldName, 'idle')
        }
        savedTimerRef.current = null
      }, SAVED_DISPLAY_MS)
    }
  }, [saveMutation.isSuccess, fieldName, setStatus])

  useEffect(() => {
    if (saveMutation.isError) {
      setStatus(fieldName, 'error')
    }
  }, [saveMutation.isError, fieldName, setStatus])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current)
      if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const triggerSave = useCallback(
    (value: string) => {
      mutateRef.current(value)
    },
    [], // mutateRef is stable via ref pattern
  )

  const setValue = useCallback(
    (value: string) => {
      setDraft(value)
      latestValueRef.current = value
      isEditingRef.current = true

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        setStatus(fieldName, 'saving')
        triggerSave(value)
        debounceTimerRef.current = null
      }, DEBOUNCE_MS)
    },
    [fieldName, setStatus, triggerSave],
  )

  const retry = useCallback(() => {
    triggerSave(latestValueRef.current)
    setStatus(fieldName, 'saving')
  }, [fieldName, setStatus, triggerSave])

  // Sync status from store
  const syncStatus: SyncStatus = getStatus

  // Auto-retry when the browser regains connectivity
  useEffect(() => {
    if (syncStatus !== 'error') return
    const handleOnline = () => retry()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncStatus, retry])

  // Value resolution: draft takes priority while editing, otherwise query data.
  // When vault is locked, return empty string (query cache is purged by lockVault).
  // Stale draft from before lock is acceptable — query data effect refreshes it on unlock.
  const value = isVaultLocked ? '' : (draft ?? fieldQuery.data ?? '')

  return { value, setValue, syncStatus, retry }
}

export { useAutoSave }
