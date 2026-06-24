import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { FormField } from '@/shared/ui/form/FormField'
import { PasswordStrength } from '@/features/auth/ui/PasswordStrength'
import { changePasswordSchema, type ChangePasswordFormData } from '@/features/auth/model/change-password-schema'
import { changeUserPassword } from '@/features/auth/model/auth-service'
import { getChangePasswordErrorMessage } from '@/features/auth/model/change-password-error-messages'
import { useChangePasswordDialogStore } from '@/shared/auth/change-password-dialog-store'

function ChangePasswordDialog() {
  const { t } = useTranslation('auth')
  const isChangePasswordDialogOpen = useChangePasswordDialogStore((s) => s.isChangePasswordDialogOpen)
  const closeChangePasswordDialog = useChangePasswordDialogStore((s) => s.closeChangePasswordDialog)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ChangePasswordFormData>({
    resolver: standardSchemaResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const watchedNewPassword = useWatch({ control, name: 'newPassword' })

  async function onFormSubmit(data: ChangePasswordFormData) {
    try {
      await changeUserPassword(data.currentPassword, data.newPassword)
      toast.success(t('changePassword.success'))
      reset()
      closeChangePasswordDialog()
    } catch (error) {
      toast.error(getChangePasswordErrorMessage(error, t))
    }
  }

  const { ref: passwordRef, ...passwordRest } = register('newPassword')

  return (
    <Dialog
      open={isChangePasswordDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset()
          setPasswordFocused(false)
          closeChangePasswordDialog()
        }
      }}
    >
      <DialogContent className="sm:max-w-md" ref={cardRef}>
        <DialogHeader>
          <DialogTitle>{t('changePassword.title')}</DialogTitle>
          <DialogDescription>{t('changePassword.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <FormField
            id="current-password"
            label={t('changePassword.currentPassword')}
            error={errors.currentPassword?.message ? t(errors.currentPassword.message) : undefined}
          >
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              autoFocus
              {...register('currentPassword')}
            />
          </FormField>

          <FormField
            id="new-password"
            label={t('changePassword.newPassword')}
            error={errors.newPassword?.message ? t(errors.newPassword.message) : undefined}
          >
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...passwordRest}
              ref={passwordRef}
              onFocus={() => setPasswordFocused(true)}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                passwordRest.onBlur(e)
                setPasswordFocused(false)
              }}
            />
          </FormField>
          <PasswordStrength
            password={watchedNewPassword ?? ''}
            open={passwordFocused}
            onOpenChange={setPasswordFocused}
            anchorRef={cardRef}
            container={cardRef}
          />

          <FormField
            id="confirm-password"
            label={t('changePassword.confirmPassword')}
            error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
          >
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register('confirmPassword')}
            />
          </FormField>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isSubmitting ? t('changePassword.submitting') : t('changePassword.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ChangePasswordDialog }
