import { useRef, useEffect, useCallback } from 'react'
import { useSyncStatusStore } from '@/features/fields/model/sync-status-store'
import type { FieldName } from '@/shared/types/entities/field.types'
import { SYNC_STATUS } from '@/features/fields/model/sync-status-store'
import type { SyncStatus } from '@/features/fields/model/sync-status-store'
import type { SaveFieldCallbacks } from '@/features/fields/model/use-field'
import { markLocalSave } from '@/shared/realtime/realtime-echo'

const DEBOUNCE_MS = 1000
const SAVED_DISPLAY_MS = 3000

type TimerRef = React.RefObject<ReturnType<typeof setTimeout> | null>
type SetSyncStatus = (entryId: string, fieldName: FieldName, status: SyncStatus) => void
type SaveMutate = (value: string, callbacks?: SaveFieldCallbacks) => void

interface UseSaveSchedulerOptions {
  entryId: string
  fieldName: FieldName
  setSyncStatus: SetSyncStatus
  saveMutate: SaveMutate
  isVaultLocked: boolean
}

/**
 * Schedule a 'saved' status to expire back to 'idle' after a delay.
 * Only transitions if the status is still 'saved' when the timer fires.
 */
function debounceResetStatus(entryId: string, fieldName: FieldName, setSyncStatus: SetSyncStatus, timerRef: TimerRef) {
  if (timerRef.current !== null) {
    clearTimeout(timerRef.current)
  }
  timerRef.current = setTimeout(() => {
    // Read latest status via getState(). We're in a setTimeout callback,
    // so we need the current value, not the stale closure value.
    const current = useSyncStatusStore.getState().status[entryId]?.[fieldName]
    if (current === SYNC_STATUS.SAVED) {
      setSyncStatus(entryId, fieldName, SYNC_STATUS.IDLE)
    }
    timerRef.current = null
  }, SAVED_DISPLAY_MS)
}

/** Clear a timer ref and null it out. */
function clearTimerRef(timerRef: TimerRef) {
  if (timerRef.current !== null) {
    clearTimeout(timerRef.current)
    timerRef.current = null
  }
}

export interface UseSaveSchedulerResult {
  /** Enqueue a value for debounced save. Overwrites any pending save. */
  debounceSave: (value: string) => void
  /** Immediately retry saving the last enqueued value. */
  retrySave: () => void
}

/**
 * Manages save scheduling, timer cleanup, and retry logic.
 */
function useSaveScheduler(options: UseSaveSchedulerOptions): UseSaveSchedulerResult {
  const { entryId, fieldName, setSyncStatus, saveMutate, isVaultLocked } = options
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestValueRef = useRef('')
  // Ref to avoid stale closures in setTimeout callbacks
  const saveMutationRef = useRef(saveMutate)

  // Keep mutateRef in sync with the latest mutation function
  useEffect(() => {
    saveMutationRef.current = saveMutate
  }, [saveMutate])

  // Clear timers when vault locks
  useEffect(() => {
    if (isVaultLocked) {
      clearTimerRef(debounceTimerRef)
      clearTimerRef(savedTimerRef)
    }
  }, [isVaultLocked])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimerRef(debounceTimerRef)
      clearTimerRef(savedTimerRef)
    }
  }, [])

  const triggerSave = useCallback(
    (value: string) => {
      setSyncStatus(entryId, fieldName, SYNC_STATUS.SAVING)
      saveMutationRef.current(value, {
        onSuccess: (updatedAt: string) => {
          setSyncStatus(entryId, fieldName, SYNC_STATUS.SAVED)
          markLocalSave(entryId, fieldName, updatedAt)
          debounceResetStatus(entryId, fieldName, setSyncStatus, savedTimerRef)
        },
        onError: () => {
          setSyncStatus(entryId, fieldName, SYNC_STATUS.ERROR)
        },
      })
    },
    [entryId, fieldName, setSyncStatus],
  )

  const debounceSave = useCallback(
    (value: string) => {
      latestValueRef.current = value
      clearTimerRef(debounceTimerRef)

      debounceTimerRef.current = setTimeout(() => {
        triggerSave(value)
        debounceTimerRef.current = null
      }, DEBOUNCE_MS)
    },
    [triggerSave],
  )

  const retrySave = useCallback(() => {
    triggerSave(latestValueRef.current)
  }, [triggerSave])

  return { debounceSave, retrySave }
}

export { useSaveScheduler }
