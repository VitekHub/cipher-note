import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { SubmitButton } from '@/shared/ui/form/SubmitButton'
import { PasswordField } from '@/features/auth/ui/PasswordField'
import { PasswordStrength } from '@/features/auth/ui/PasswordStrength'
import { changePasswordSchema, type ChangePasswordFormData } from '@/features/auth/model/change-password-schema'
import { changeUserPassword } from '@/features/auth/model/auth-service'
import { getChangePasswordErrorMessage } from '@/features/auth/model/change-password-error-messages'
import { useChangePasswordDialogStore } from '@/shared/stores/dialogs-store'

function ChangePasswordDialog() {
  const { t } = useTranslation('auth')
  const isOpen = useChangePasswordDialogStore((s) => s.isOpen)
  const close = useChangePasswordDialogStore((s) => s.close)
  const cardRef = useRef<HTMLDivElement>(null)

  const methods = useForm<ChangePasswordFormData>({
    resolver: standardSchemaResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
    reset,
  } = methods

  const watchedNewPassword = useWatch({ control, name: 'newPassword' })

  async function onFormSubmit(data: ChangePasswordFormData) {
    try {
      await changeUserPassword(data.currentPassword, data.newPassword)
      toast.success(t('changePassword.success'))
      reset()
      close()
    } catch (error) {
      toast.error(getChangePasswordErrorMessage(error, t))
    }
  }

  return (
    <Dialog
      open={isOpen}
      preventClose={isSubmitting}
      onOpenChange={(open) => {
        if (!open) {
          reset()
          close()
        }
      }}
    >
      <DialogContent className="sm:max-w-md" ref={cardRef}>
        <DialogHeader>
          <DialogTitle>{t('changePassword.title')}</DialogTitle>
          <DialogDescription>{t('changePassword.description')}</DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <PasswordField
              name="currentPassword"
              label={t('changePassword.currentPassword')}
              autoComplete="current-password"
              autoFocus
            />

            <PasswordField name="newPassword" label={t('changePassword.newPassword')} autoComplete="new-password" />
            <PasswordStrength password={watchedNewPassword ?? ''} anchorRef={cardRef} container={cardRef} />

            <PasswordField
              name="confirmPassword"
              label={t('changePassword.confirmPassword')}
              autoComplete="new-password"
            />

            <SubmitButton
              isSubmitting={isSubmitting}
              submitLabel={t('changePassword.submit')}
              submittingLabel={t('changePassword.submitting')}
              dataTestId="change-password-submit"
            />
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}

export { ChangePasswordDialog }
