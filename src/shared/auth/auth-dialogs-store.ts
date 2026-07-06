import { createDialogStore } from '@/shared/ui/create-dialog-store'

export const useChangePasswordDialogStore = createDialogStore('ChangePasswordDialogStore')
export const useRegenerateMnemonicDialogStore = createDialogStore('RegenerateMnemonicDialogStore')
export const useVerifyMnemonicDialogStore = createDialogStore('VerifyMnemonicDialogStore')
