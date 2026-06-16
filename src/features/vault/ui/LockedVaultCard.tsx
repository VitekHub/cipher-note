import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'

import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'
import { Button } from '@/shared/ui/button'

function LockedVaultCard() {
  const { t } = useTranslation('fields')
  const openUnlockDialog = useVaultDialogStore((s) => s.openUnlockDialog)

  return (
    <div className="flex min-h-full flex-1 items-center justify-center">
      <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl p-12">
        <div className="bg-primary/5 absolute inset-0 [mask:radial-gradient(circle_at_center,black_60%,transparent_100%)]" />
        <Lock className="text-muted-foreground/60 relative size-10" />
        <p className="text-muted-foreground relative text-sm">{t('vaultLocked')}</p>
        <Button variant="outline" onClick={openUnlockDialog} className="relative">
          {t('unlockVault')}
        </Button>
      </div>
    </div>
  )
}

export { LockedVaultCard }
