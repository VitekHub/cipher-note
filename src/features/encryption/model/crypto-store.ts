import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { QueryClient } from '@tanstack/react-query'

interface CryptoState {
  masterKey: string | null
  kek: string | null
  fieldKeys: Record<string, string>
  isVaultLocked: boolean
  lastActivity: number
}

interface CryptoActions {
  setKeys: (masterKey: string, kek: string, fieldKeys: Record<string, string>) => void
  lockVault: () => void
  updateActivity: () => void
  // TEMP: flip vault locked state for manual testing (remove after Step 22)
  toggleVaultLock: () => void
}

const selectFieldKey = (fieldName: string) => (state: CryptoState) => state.fieldKeys[fieldName] ?? null

const initialState: CryptoState = {
  masterKey: null,
  kek: null,
  fieldKeys: {},
  isVaultLocked: true,
  lastActivity: 0,
}

let queryClientRef: QueryClient | null = null

function setQueryClient(client: QueryClient) {
  queryClientRef = client
}

const useCryptoStore = create<CryptoState & CryptoActions>()(
  devtools(
    (set) => ({
      ...initialState,
      setKeys: (masterKey, kek, fieldKeys) =>
        set(
          {
            masterKey,
            kek,
            fieldKeys,
            isVaultLocked: false,
            lastActivity: Date.now(),
          },
          false,
          'crypto/setKeys',
        ),
      lockVault: () => {
        set(initialState, false, 'crypto/lockVault')
        queryClientRef?.removeQueries({ queryKey: ['field'] })
      },
      updateActivity: () => set({ lastActivity: Date.now() }, false, 'crypto/updateActivity'),
      // TEMP: flip vault locked state for manual testing (remove after Step 22)
      toggleVaultLock: () =>
        set(
          (state) => ({ isVaultLocked: !state.isVaultLocked, lastActivity: Date.now() }),
          false,
          'crypto/toggleVaultLock',
        ),
    }),
    { name: 'CryptoStore' },
  ),
)

export { useCryptoStore, selectFieldKey, setQueryClient }
export type { CryptoState, CryptoActions }
