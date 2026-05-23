import { useEffect, useRef, useCallback } from 'react'

import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { lockVault } from '@/features/encryption/model/vault-lock'

export const DEFAULT_VAULT_TIMEOUT_MS = 15 * 60 * 1000

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function useVaultTimeout(timeoutMs: number = DEFAULT_VAULT_TIMEOUT_MS): void {
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      lockVault()
    }, timeoutMs)
  }, [timeoutMs])

  useEffect(() => {
    if (isVaultLocked) {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
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
  }, [isVaultLocked, resetTimeout])
}
