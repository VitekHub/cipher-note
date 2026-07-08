import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Unlock } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/ui/button'
import { Spinner } from '@/shared/ui/Spinner'
import { keyVault } from '@/shared/crypto/vault/key-vault'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useSyncStatusStore, isSaving, isPaused } from '@/features/fields/model/sync-status-store'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'

interface VaultLockButtonProps {
  variant: 'icon' | 'label'
  onBeforeToggle?: () => void
  className?: string
}

function VaultLockButton({ variant, onBeforeToggle, className }: VaultLockButtonProps) {
  const { t } = useTranslation('vault')
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const openUnlockDialog = useVaultDialogStore((s) => s.open)
  const [isLocking, setIsLocking] = useState(false)

  function handleVaultLock() {
    onBeforeToggle?.()
    if (isVaultLocked) {
      openUnlockDialog()
      return
    }

    // Already not saving or mutation is paused? Proceed immediately.
    if (!isSaving() || isPaused()) {
      keyVault.lockVault()
      return
    }

    setIsLocking(true)
    const toastId = toast.loading(t('fields:status.saving'), {
      duration: Infinity,
    })
    // Save in progress, subscribe and lock when it completes
    const unsubscribe = useSyncStatusStore.subscribe(() => {
      if (!isSaving() || isPaused()) {
        unsubscribe()
        toast.dismiss(toastId)
        keyVault.lockVault()
        setIsLocking(false)
      }
    })
  }

  function renderLockIcon(size: string) {
    if (isLocking) return <Spinner className={size} />
    if (isVaultLocked) return <Unlock className={size} />
    return <Lock className={size} />
  }

  const label = isVaultLocked ? t('unlock') : isLocking ? t('locking') : t('lock')

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={className}
        onClick={handleVaultLock}
        disabled={isLocking}
        aria-label={label}
      >
        {renderLockIcon('size-5')}
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" className={className} onClick={handleVaultLock} disabled={isLocking}>
      {renderLockIcon('size-4')}
      <span>{label}</span>
    </Button>
  )
}

export { VaultLockButton }
