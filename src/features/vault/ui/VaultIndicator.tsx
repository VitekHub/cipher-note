import { useTranslation } from 'react-i18next'
import { Lock, Unlock } from 'lucide-react'

import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'
import { cn } from '@/shared/lib/utils'

function VaultIndicator() {
  const { t } = useTranslation('vault')
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const openUnlockDialog = useVaultDialogStore((s) => s.open)

  if (isVaultLocked) {
    return (
      <button
        type="button"
        onClick={openUnlockDialog}
        className={cn(
          'flex min-h-11 min-w-11 items-center gap-1.5 text-sm transition-colors duration-300 md:min-h-8 md:min-w-8',
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
