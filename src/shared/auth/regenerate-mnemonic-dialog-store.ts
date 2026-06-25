import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface RegenerateMnemonicDialogStore {
  isRegenerateMnemonicDialogOpen: boolean
  openRegenerateMnemonicDialog: () => void
  closeRegenerateMnemonicDialog: () => void
}

const useRegenerateMnemonicDialogStore = create<RegenerateMnemonicDialogStore>()(
  devtools(
    (set) => ({
      isRegenerateMnemonicDialogOpen: false,
      openRegenerateMnemonicDialog: () =>
        set({ isRegenerateMnemonicDialogOpen: true }, false, 'regenerateMnemonicDialog/open'),
      closeRegenerateMnemonicDialog: () =>
        set({ isRegenerateMnemonicDialogOpen: false }, false, 'regenerateMnemonicDialog/close'),
    }),
    { name: 'RegenerateMnemonicDialogStore' },
  ),
)

export { useRegenerateMnemonicDialogStore }
