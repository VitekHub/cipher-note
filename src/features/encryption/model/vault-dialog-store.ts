import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface VaultDialogState {
  isUnlockDialogOpen: boolean
}

interface VaultDialogActions {
  openUnlockDialog: () => void
  closeUnlockDialog: () => void
}

const useVaultDialogStore = create<VaultDialogState & VaultDialogActions>()(
  devtools(
    (set) => ({
      isUnlockDialogOpen: false,
      openUnlockDialog: () => set({ isUnlockDialogOpen: true }, false, 'vaultDialog/open'),
      closeUnlockDialog: () => set({ isUnlockDialogOpen: false }, false, 'vaultDialog/close'),
    }),
    { name: 'VaultDialogStore' },
  ),
)

export { useVaultDialogStore }
