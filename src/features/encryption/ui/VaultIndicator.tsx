import { useTranslation } from 'react-i18next'
import { Lock, Unlock } from 'lucide-react'

import { useCryptoStore } from '@/features/encryption/model/crypto-store'

function VaultIndicator() {
  const { t } = useTranslation('crypto')
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)

  if (isVaultLocked) {
    return (
      <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Lock className="size-4" />
        <span>{t('vault.locked')}</span>
      </div>
    )
  }

  return (
    <div className="text-primary flex items-center gap-1.5 text-sm">
      <Unlock className="size-4" />
      <span>{t('vault.unlocked')}</span>
    </div>
  )
}

export { VaultIndicator }
