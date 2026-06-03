import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'

import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/shared/crypto/vault-dialog-store'
import { useAuth } from '@/shared/auth/auth-context'
import { unlockVault } from '@/features/encryption/model/vault-unlock'
import { getCryptoErrorMessage } from '@/features/encryption/model/crypto-error-messages'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { FormField } from '@/shared/ui/form/FormField'

const unlockSchema = z.object({
  password: z.string().min(1),
})

type UnlockFormData = z.infer<typeof unlockSchema>

function VaultUnlockDialog() {
  const { t } = useTranslation('crypto')
  const { user } = useAuth()
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const isUnlockDialogOpen = useVaultDialogStore((s) => s.isUnlockDialogOpen)
  const closeUnlockDialog = useVaultDialogStore((s) => s.closeUnlockDialog)
  const [error, setError] = useState<string | null>(null)
  const wasLockedRef = useRef(isVaultLocked)

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = useForm<UnlockFormData>({
    resolver: standardSchemaResolver(unlockSchema),
    defaultValues: { password: '' },
  })

  useEffect(() => {
    if (wasLockedRef.current && !isVaultLocked) {
      closeUnlockDialog()
      reset({ password: '' })
      setError(null)
    }
    wasLockedRef.current = isVaultLocked
  }, [isVaultLocked, closeUnlockDialog, reset])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeUnlockDialog()
    },
    [closeUnlockDialog],
  )

  async function onSubmit(data: UnlockFormData) {
    setError(null)
    if (!user) {
      setError('No authenticated user')
      return
    }
    try {
      await unlockVault(user.id, data.password)
    } catch (err) {
      setError(getCryptoErrorMessage(err, t))
    }
  }

  return (
    <Dialog open={isUnlockDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('vaultUnlock.title')}</DialogTitle>
          <DialogDescription>{t('vaultUnlock.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField id="vault-password" label={t('vaultUnlock.password')} error={error ?? undefined}>
            <Input
              id="vault-password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              autoFocus
              {...register('password')}
            />
          </FormField>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? t('vaultUnlock.submitting') : t('vaultUnlock.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { VaultUnlockDialog }
