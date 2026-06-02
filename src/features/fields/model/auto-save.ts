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
 * debounces saves (1s after last keystroke), and tracks sync status.
 */
function useAutoSave(fieldName: FieldName): UseAutoSaveResult {
  const fieldQuery = useField(fieldName)
  const saveMutation = useSaveField(fieldName)
  const setStatus = useSyncStatusStore((s) => s.setStatus)
  const syncStatus = useSyncStatusStore((s) => s.status[fieldName])
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)

  // Local draft: null means "use query data"
  const [draft, setDraft] = useState<string | null>(null)

  // Reset draft when vault locks
  const [prevIsVaultLocked, setPrevIsVaultLocked] = useState(isVaultLocked)
  if (isVaultLocked !== prevIsVaultLocked) {
    setPrevIsVaultLocked(isVaultLocked)
    if (isVaultLocked) {
      setDraft(null)
    }
  }
  const latestValueRef = useRef('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref to avoid stale closures in setTimeout callbacks
  const mutateRef = useRef(saveMutation.mutate)

  // Keep mutateRef in sync with the latest mutation function
  useEffect(() => {
    mutateRef.current = saveMutation.mutate
  }, [saveMutation.mutate])

  // When vault locks, clear pending timers
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
    }
  }, [isVaultLocked])

  // Reset stale "saved" status on mount
  useEffect(() => {
    if (useSyncStatusStore.getState().status[fieldName] === 'saved') {
      setStatus(fieldName, 'idle')
    }
  }, [fieldName, setStatus])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current)
      if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const triggerSave = useCallback(
    (value: string) => {
      mutateRef.current(value, {
        onSuccess: () => {
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
        },
        onError: () => {
          setStatus(fieldName, 'error')
        },
      })
    },
    [fieldName, setStatus],
  )

  const setValue = useCallback(
    (value: string) => {
      setDraft(value)
      latestValueRef.current = value

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

  // Auto-retry when the browser regains connectivity — listener is always
  // registered; the handler checks status imperatively to avoid add/remove churn.
  useEffect(() => {
    const handleOnline = () => {
      if (useSyncStatusStore.getState().status[fieldName] === 'error') {
        retry()
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [fieldName, retry])

  // Value resolution: draft takes priority while editing, otherwise query data.
  // When vault is locked, return empty string (query cache is purged by lockVault).
  // draft=null means "not yet edited" — falls through to fieldQuery.data.
  const value = isVaultLocked ? '' : (draft ?? fieldQuery.data ?? '')

  return { value, setValue, syncStatus, retry }
}

export { useAutoSave }
