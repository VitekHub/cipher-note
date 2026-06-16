import { useTranslation } from 'react-i18next'
import { Lock, Unlock } from 'lucide-react'

import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'
import { cn } from '@/shared/lib/utils'

function VaultIndicator() {
  const { t } = useTranslation('vault')
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const openUnlockDialog = useVaultDialogStore((s) => s.openUnlockDialog)

  if (isVaultLocked) {
    return (
      <button
        type="button"
        onClick={openUnlockDialog}
        className={cn(
          'flex items-center gap-1.5 text-sm transition-colors duration-300',
          'text-muted-foreground hover:text-foreground cursor-pointer',
        )}
        aria-label={t('unlock')}
      >
        <Lock className="size-4" />
        <span>{t('locked')}</span>
      </button>
    )
  }

  return (
    <div className="text-primary flex items-center gap-1.5 text-sm transition-colors duration-300">
      <Unlock className="size-4" />
      <span>{t('unlocked')}</span>
    </div>
  )
}

export { VaultIndicator }
