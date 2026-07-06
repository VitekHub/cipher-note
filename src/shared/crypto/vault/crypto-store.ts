import { create } from 'zustand'
import type { QueryClient } from '@tanstack/react-query'
import type { CachedVaultEnvelope, ServerFieldKey } from '@/shared/types/api.types'
import { queryKeys } from '@/shared/lib/query-keys'
import { clearEchoMarkers } from '@/shared/realtime/realtime-echo'

interface CryptoState {
  loadedFieldKeys: Record<string, boolean>
  isVaultLocked: boolean
  lastActivity: number
  // Cached envelope data — survives lock, purged on logout
  cachedEnvelope: CachedVaultEnvelope | null
}

interface CryptoActions {
  markKeysLoaded: (fieldKeyNames: string[]) => void
  setCachedEnvelope: (envelope: CachedVaultEnvelope) => void
  clearCachedEnvelope: () => void
  updateCachedFieldKey: (fieldKey: ServerFieldKey) => void
  lockVault: () => void
  clearVault: () => void
  updateActivity: () => void
}

const hasCachedEnvelope = (state: CryptoState) => state.cachedEnvelope !== null

const initialState: CryptoState = {
  loadedFieldKeys: {},
  isVaultLocked: true,
  lastActivity: 0,
  cachedEnvelope: null,
}

let queryClientRef: QueryClient | null = null

function setQueryClient(client: QueryClient) {
  queryClientRef = client
}

/** Remove all vault-related queries (field, entry). */
function clearVaultQueries() {
  queryClientRef?.removeQueries({ queryKey: queryKeys.field.all })
  queryClientRef?.removeQueries({ queryKey: queryKeys.entry.all })
}

const useCryptoStore = create<CryptoState & CryptoActions>()((set) => ({
  ...initialState,
  markKeysLoaded: (fieldKeyNames) =>
    set({
      loadedFieldKeys: Object.fromEntries(fieldKeyNames.map((name) => [name, true])),
      isVaultLocked: false,
      lastActivity: Date.now(),
    }),
  setCachedEnvelope: (envelope) => set({ cachedEnvelope: envelope }),
  clearCachedEnvelope: () => set({ cachedEnvelope: null }),
  updateCachedFieldKey: (fieldKey) =>
    set((state) => {
      if (!state.cachedEnvelope) return {}
      const others = state.cachedEnvelope.fieldKeys.filter((k) => k.fieldName !== fieldKey.fieldName)
      return { cachedEnvelope: { ...state.cachedEnvelope, fieldKeys: [...others, fieldKey] } }
    }),
  lockVault: () => {
    set({
      loadedFieldKeys: {},
      isVaultLocked: true,
      lastActivity: 0,
    })
    clearVaultQueries()
    clearEchoMarkers()
  },
  clearVault: () => {
    set(initialState)
    clearVaultQueries()
    clearEchoMarkers()
  },
  updateActivity: () => set({ lastActivity: Date.now() }),
}))

export { useCryptoStore, hasCachedEnvelope, setQueryClient }
export type { CryptoState, CryptoActions }
