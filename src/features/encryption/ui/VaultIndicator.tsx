import { useTranslation } from 'react-i18next'
import { Lock, Unlock } from 'lucide-react'

import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { cn } from '@/shared/lib/utils'

function VaultIndicator() {
  const { t } = useTranslation('crypto')
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-sm transition-colors duration-300',
        isVaultLocked ? 'text-muted-foreground' : 'text-primary',
      )}
    >
      {isVaultLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
      <span>{isVaultLocked ? t('vault.locked') : t('vault.unlocked')}</span>
    </div>
  )
}

export { VaultIndicator }
