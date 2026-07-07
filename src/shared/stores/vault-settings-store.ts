import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

/** Default inactivity auto-lock timeout (15 minutes). */
const DEFAULT_VAULT_TIMEOUT_MS = 15 * 60 * 1000

interface VaultSettingsState {
  vaultTimeoutMs: number
  lockOnTabHidden: boolean
}

interface VaultSettingsActions {
  setVaultTimeoutMs: (ms: number) => void
  setLockOnTabHidden: (enabled: boolean) => void
}

const useVaultSettingsStore = create<VaultSettingsState & VaultSettingsActions>()(
  devtools(
    persist(
      (set) => ({
        vaultTimeoutMs: DEFAULT_VAULT_TIMEOUT_MS,
        lockOnTabHidden: false,
        setVaultTimeoutMs: (ms) => set({ vaultTimeoutMs: ms }, false, 'vaultSettings/setVaultTimeoutMs'),
        setLockOnTabHidden: (enabled) => set({ lockOnTabHidden: enabled }, false, 'vaultSettings/setLockOnTabHidden'),
      }),
      {
        name: 'cipher-note-vault-settings',
        partialize: (state) => ({
          vaultTimeoutMs: state.vaultTimeoutMs,
          lockOnTabHidden: state.lockOnTabHidden,
        }),
      },
    ),
    { name: 'VaultSettingsStore' },
  ),
)

export { useVaultSettingsStore, DEFAULT_VAULT_TIMEOUT_MS }
export type { VaultSettingsState, VaultSettingsActions }
