import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ChangePasswordDialogStore {
  isChangePasswordDialogOpen: boolean
  openChangePasswordDialog: () => void
  closeChangePasswordDialog: () => void
}

const useChangePasswordDialogStore = create<ChangePasswordDialogStore>()(
  devtools(
    (set) => ({
      isChangePasswordDialogOpen: false,
      openChangePasswordDialog: () => set({ isChangePasswordDialogOpen: true }, false, 'changePasswordDialog/open'),
      closeChangePasswordDialog: () => set({ isChangePasswordDialogOpen: false }, false, 'changePasswordDialog/close'),
    }),
    { name: 'ChangePasswordDialogStore' },
  ),
)

export { useChangePasswordDialogStore }
