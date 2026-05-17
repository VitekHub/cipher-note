import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

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
}

const selectFieldKey = (fieldName: string) => (state: CryptoState) => state.fieldKeys[fieldName] ?? null

const initialState: CryptoState = {
  masterKey: null,
  kek: null,
  fieldKeys: {},
  isVaultLocked: true,
  lastActivity: 0,
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
      lockVault: () => set(initialState, false, 'crypto/lockVault'),
      updateActivity: () => set({ lastActivity: Date.now() }, false, 'crypto/updateActivity'),
    }),
    { name: 'CryptoStore' },
  ),
)

export { useCryptoStore, selectFieldKey }
export type { CryptoState, CryptoActions }
