import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { keyVault } from '@/shared/crypto/vault/key-vault'
import { useVaultSettingsStore } from '@/shared/stores/vault-settings-store'

/**
 * Locks the vault when the document becomes hidden (tab switch, minimize,
 * screen lock) if the user has enabled the setting. No-op when the vault is
 * already locked, so it never fires redundantly with the inactivity timer.
 */
export function useVaultVisibilityLock(): void {
  const enabled = useVaultSettingsStore((s) => s.lockOnTabHidden)
  const { t } = useTranslation('vault')

  useEffect(() => {
    if (!enabled) return

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden' && !useCryptoStore.getState().isVaultLocked) {
        keyVault.lockVault()
        toast.warning(t('tabSwitchLocked'))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, t])
}
