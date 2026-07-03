import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface VerifyMnemonicDialogStore {
  isVerifyMnemonicDialogOpen: boolean
  openVerifyMnemonicDialog: () => void
  closeVerifyMnemonicDialog: () => void
}

const useVerifyMnemonicDialogStore = create<VerifyMnemonicDialogStore>()(
  devtools(
    (set) => ({
      isVerifyMnemonicDialogOpen: false,
      openVerifyMnemonicDialog: () => set({ isVerifyMnemonicDialogOpen: true }, false, 'verifyMnemonicDialog/open'),
      closeVerifyMnemonicDialog: () => set({ isVerifyMnemonicDialogOpen: false }, false, 'verifyMnemonicDialog/close'),
    }),
    { name: 'VerifyMnemonicDialogStore' },
  ),
)

export { useVerifyMnemonicDialogStore }
