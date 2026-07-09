import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { PasswordConfirmDialog } from '@/shared/ui/PasswordConfirmDialog'
import { useDeleteAccountDialogStore } from '@/shared/stores/dialogs-store'
import { deleteUserAccount } from '@/features/auth/model/auth-service'
import { getDeleteAccountErrorMessage } from '@/features/auth/model/delete-account-error-messages'

function DeleteAccountDialog() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const isOpen = useDeleteAccountDialogStore((s) => s.isOpen)
  const closeDialog = useDeleteAccountDialogStore((s) => s.close)

  async function handleConfirm(password: string) {
    await deleteUserAccount(password)
    toast.success(t('deleteAccount.success'))
    closeDialog()
    navigate({ to: '/login' })
  }

  function mapError(error: unknown) {
    return getDeleteAccountErrorMessage(error, t)
  }

  return (
    <PasswordConfirmDialog
      isOpen={isOpen}
      onClose={closeDialog}
      onConfirm={handleConfirm}
      mapError={mapError}
      title={t('deleteAccount.title')}
      description={t('deleteAccount.description')}
      submitLabel={t('deleteAccount.submit')}
      isSubmittingLabel={t('deleteAccount.submitting')}
      variant="destructive"
      submitTestId="delete-account-submit"
    />
  )
}

export { DeleteAccountDialog }
