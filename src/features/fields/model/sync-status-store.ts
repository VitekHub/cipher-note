import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FieldName } from '@/shared/types/entities/field.types'

export const SYNC_STATUS = {
  IDLE: 'idle',
  SAVING: 'saving',
  PAUSED: 'paused',
  SAVED: 'saved',
  ERROR: 'error',
  REMOTE_UPDATE: 'remote-update',
} as const

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS]

interface SyncStatusState {
  status: Record<string, Record<FieldName, SyncStatus>>
}

interface SyncStatusActions {
  setStatus: (entryId: string, fieldName: FieldName, status: SyncStatus) => void
  resetAll: () => void
}

function updateFieldStatus(
  state: SyncStatusState,
  entryId: string,
  fieldName: FieldName,
  status: SyncStatus,
): SyncStatusState {
  return {
    status: {
      ...state.status,
      [entryId]: {
        ...state.status[entryId],
        [fieldName]: status,
      },
    },
  }
}

const useSyncStatusStore = create<SyncStatusState & SyncStatusActions>()(
  devtools(
    (set) => ({
      status: {},
      setStatus: (entryId, fieldName, newStatus) =>
        set(
          (state) => updateFieldStatus(state, entryId, fieldName, newStatus),
          false,
          `syncStatus/setStatus/${entryId}/${fieldName}`,
        ),
      resetAll: () => set({ status: {} }, false, 'syncStatus/resetAll'),
    }),
    { name: 'SyncStatusStore' },
  ),
)

/** Selector hook: subscribes to a single (entryId, fieldName) status only. */
function useFieldSyncStatus(entryId: string, fieldName: FieldName): SyncStatus {
  return useSyncStatusStore((s) => s.status[entryId]?.[fieldName] ?? SYNC_STATUS.IDLE)
}

export { useSyncStatusStore, useFieldSyncStatus }
