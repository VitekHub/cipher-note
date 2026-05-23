import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { QueryClient } from '@tanstack/react-query'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'

interface CryptoState {
  masterKey: string | null
  kek: string | null
  fieldKeys: Record<string, string>
  isVaultLocked: boolean
  lastActivity: number
  // Cached envelope data — survives lock, purged on logout
  cachedEnvelope: CachedVaultEnvelope | null
}

interface CryptoActions {
  setKeys: (masterKey: string, kek: string, fieldKeys: Record<string, string>) => void
  setCachedEnvelope: (envelope: CachedVaultEnvelope) => void
  lockVault: () => void
  clearVault: () => void
  updateActivity: () => void
}

const selectFieldKey = (fieldName: string) => (state: CryptoState) => state.fieldKeys[fieldName] ?? null

const hasCachedEnvelope = (state: CryptoState) => state.cachedEnvelope !== null

const initialState: CryptoState = {
  masterKey: null,
  kek: null,
  fieldKeys: {},
  isVaultLocked: true,
  lastActivity: 0,
  cachedEnvelope: null,
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
      setCachedEnvelope: (envelope) => set({ cachedEnvelope: envelope }, false, 'crypto/setCachedEnvelope'),
      lockVault: () => {
        set(
          {
            masterKey: null,
            kek: null,
            fieldKeys: {},
            isVaultLocked: true,
            lastActivity: 0,
          },
          false,
          'crypto/lockVault',
        )
        queryClientRef?.removeQueries({ queryKey: ['field'] })
      },
      clearVault: () => {
        set(initialState, false, 'crypto/clearVault')
        queryClientRef?.removeQueries({ queryKey: ['field'] })
      },
      updateActivity: () => set({ lastActivity: Date.now() }, false, 'crypto/updateActivity'),
    }),
    { name: 'CryptoStore' },
  ),
)

export { useCryptoStore, selectFieldKey, hasCachedEnvelope, setQueryClient }
export type { CryptoState, CryptoActions }
