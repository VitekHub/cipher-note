import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FieldName } from '@/shared/types/entities/field.types'

export type SyncStatus = 'idle' | 'saving' | 'paused' | 'saved' | 'error'

interface SyncStatusState {
  status: Record<FieldName, SyncStatus>
}

interface SyncStatusActions {
  setStatus: (fieldName: FieldName, status: SyncStatus) => void
  resetField: (fieldName: FieldName) => void
  resetAll: () => void
}

const initialStatus: Record<FieldName, SyncStatus> = {
  note: 'idle',
  website: 'idle',
  email: 'idle',
}

const useSyncStatusStore = create<SyncStatusState & SyncStatusActions>()(
  devtools(
    (set) => ({
      status: { ...initialStatus },
      setStatus: (fieldName, status) =>
        set(
          (state) => ({ status: { ...state.status, [fieldName]: status } }),
          false,
          `syncStatus/setStatus/${fieldName}`,
        ),
      resetField: (fieldName) =>
        set(
          (state) => ({ status: { ...state.status, [fieldName]: 'idle' } }),
          false,
          `syncStatus/resetField/${fieldName}`,
        ),
      resetAll: () => set({ status: { ...initialStatus } }, false, 'syncStatus/resetAll'),
    }),
    { name: 'SyncStatusStore' },
  ),
)

export { useSyncStatusStore }
