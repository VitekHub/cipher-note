import { useEffect } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSyncStatusStore, isSaving, isPaused } from '@/features/fields/model/sync-status-store'

/**
 * Blocks in-app and browser navigation while saves are in progress.
 * Auto-proceeds once all saves complete.
 */
function useNavigationBlocker() {
  const { t } = useTranslation('fields')
  const { status, proceed } = useBlocker({
    shouldBlockFn: isSaving,
    enableBeforeUnload: isSaving,
    withResolver: true,
  })

  useEffect(() => {
    if (status !== 'blocked') return

    // Already not saving? Proceed immediately.
    if (!isSaving() || isPaused()) {
      proceed()
      return
    }

    const toastId = toast.loading(t('status.saving'), {
      duration: Infinity,
    })

    // Subscribe and auto-proceed when saves complete
    const unsubscribe = useSyncStatusStore.subscribe(() => {
      if (!isSaving() || isPaused()) {
        unsubscribe()
        toast.dismiss(toastId)
        proceed()
      }
    })
    return () => {
      unsubscribe()
      toast.dismiss(toastId)
    }
  }, [status, proceed, t])
}

export { useNavigationBlocker }
