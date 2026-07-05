import { createDialogStore, createDialogStoreWithPayload } from '@/shared/ui/create-dialog-store'
import type { FieldName } from '@/shared/types/entities/field.types'

export const useChangePasswordDialogStore = createDialogStore('ChangePasswordDialogStore')
export const useRegenerateMnemonicDialogStore = createDialogStore('RegenerateMnemonicDialogStore')
export const useVerifyMnemonicDialogStore = createDialogStore('VerifyMnemonicDialogStore')

/**
 * Payload for the field-key rotation dialog. `fieldName` is null for the
 * rotate-all action; otherwise it names the single field being rotated.
 */
export type RotateFieldKeyPayload = { fieldName: FieldName | null }

export const useRotateFieldKeyDialogStore =
  createDialogStoreWithPayload<RotateFieldKeyPayload>('RotateFieldKeyDialogStore')
