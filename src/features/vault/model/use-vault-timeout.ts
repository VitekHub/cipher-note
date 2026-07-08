import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { keyVault } from '@/shared/crypto/vault/key-vault'

export const DEFAULT_VAULT_TIMEOUT_MS = 15 * 60 * 1000

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function useVaultTimeout(timeoutMs: number = DEFAULT_VAULT_TIMEOUT_MS): void {
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const { t } = useTranslation('vault')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isVaultLocked) {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    function resetTimeout() {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        keyVault.lockVault()
        toast.warning(t('inactivityLocked'))
      }, timeoutMs)
    }

    resetTimeout()

    const handlers = ACTIVITY_EVENTS.map((event) => {
      const handler = () => resetTimeout()
      document.addEventListener(event, handler, { passive: true })
      return { event, handler }
    })

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      for (const { event, handler } of handlers) {
        document.removeEventListener(event, handler)
      }
    }
  }, [isVaultLocked, timeoutMs, t])
}
