import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface VaultDialogStore {
  isUnlockDialogOpen: boolean
  openUnlockDialog: () => void
  closeUnlockDialog: () => void
}

const useVaultDialogStore = create<VaultDialogStore>()(
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
