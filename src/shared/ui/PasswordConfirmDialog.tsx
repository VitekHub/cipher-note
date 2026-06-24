import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { FormField } from '@/shared/ui/form/FormField'
import { SubmitButton } from '@/shared/ui/form/SubmitButton'

const passwordConfirmSchema = z.object({
  password: z.string().min(1),
})

type PasswordConfirmFormData = z.infer<typeof passwordConfirmSchema>

interface PasswordConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (password: string) => Promise<void>
  mapError: (error: unknown) => string
  title: string
  description: string
  submitLabel: string
  isSubmittingLabel: string
}

function PasswordConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  mapError,
  title,
  description,
  submitLabel,
  isSubmittingLabel,
}: PasswordConfirmDialogProps) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = useForm<PasswordConfirmFormData>({
    resolver: standardSchemaResolver(passwordConfirmSchema),
    defaultValues: { password: '' },
  })

  async function onSubmit(data: PasswordConfirmFormData) {
    setError(null)
    try {
      await onConfirm(data.password)
      handleOpenChange(false)
    } catch (err) {
      setError(mapError(err))
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset({ password: '' })
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} preventClose={isSubmitting} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField id="password-confirm" label={t('auth:password')} error={error ?? undefined}>
            <Input
              id="password-confirm"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              aria-invalid={!!error}
              autoFocus
              {...register('password')}
            />
          </FormField>
          <SubmitButton isSubmitting={isSubmitting} submitLabel={submitLabel} submittingLabel={isSubmittingLabel} />
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { PasswordConfirmDialog }
export type { PasswordConfirmDialogProps }
