import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'

import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'
import { useAuth } from '@/shared/auth/auth-context'
import { keyVault } from '@/shared/crypto/key-vault'
import { getVaultErrorMessage } from '@/features/vault/model/vault-error-messages'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { FormField } from '@/shared/ui/form/FormField'

const unlockSchema = z.object({
  password: z.string().min(1),
})

type UnlockFormData = z.infer<typeof unlockSchema>

function VaultUnlockDialog() {
  const { t } = useTranslation('vault')
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
      await keyVault.unlockVault(user.id, data.password)
    } catch (err) {
      setError(getVaultErrorMessage(err, t))
    }
  }

  return (
    <Dialog open={isUnlockDialogOpen} preventClose={isSubmitting} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('vaultUnlockDialog.title')}</DialogTitle>
          <DialogDescription>{t('vaultUnlockDialog.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField id="vault-password" label={t('vaultUnlockDialog.password')} error={error ?? undefined}>
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
            {isSubmitting ? t('vaultUnlockDialog.submitting') : t('vaultUnlockDialog.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { VaultUnlockDialog }
