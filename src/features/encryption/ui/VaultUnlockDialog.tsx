import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useVaultDialogStore } from '@/features/encryption/model/vault-dialog-store'
import { unlockVault } from '@/features/encryption/model/vault-lock'
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
    resolver: zodResolver(unlockSchema),
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
    try {
      await unlockVault(data.password)
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
