import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff, Wifi } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

// Static keys so i18next-parser can discover them
const OFFLINE_I18N_KEY = 'status.offline'
const BACK_ONLINE_I18N_KEY = 'status.backOnline'

type BannerState = 'hidden' | 'offline' | 'back-online' | 'exiting'

const BACK_ONLINE_DISPLAY_MS = 3000
const EXIT_ANIMATION_MS = 250

function useOfflineBanner() {
  const [bannerState, setBannerState] = useState<BannerState>(() => (!navigator.onLine ? 'offline' : 'hidden'))
  const timersRef = useRef<{ hide?: ReturnType<typeof setTimeout>; exit?: ReturnType<typeof setTimeout> }>({})

  useEffect(() => {
    function handleOffline() {
      clearTimeout(timersRef.current.hide)
      clearTimeout(timersRef.current.exit)
      setBannerState('offline')
    }

    function handleOnline() {
      setBannerState('back-online')
      timersRef.current.hide = setTimeout(() => {
        setBannerState('exiting')
        timersRef.current.exit = setTimeout(() => {
          setBannerState('hidden')
        }, EXIT_ANIMATION_MS)
      }, BACK_ONLINE_DISPLAY_MS)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const timers = timersRef.current
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimeout(timers.hide)
      clearTimeout(timers.exit)
    }
  }, [])

  return { bannerState }
}

function OfflineBanner() {
  const { bannerState } = useOfflineBanner()
  const { t } = useTranslation('common')

  if (bannerState === 'hidden') return null

  const isBackOnline = bannerState === 'back-online' || bannerState === 'exiting'
  const isExiting = bannerState === 'exiting'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center border-b px-4 py-1.5 text-sm backdrop-blur-sm transition-colors duration-300',
        isExiting ? 'animate-fade-out-up' : 'animate-fade-in-up',
        isBackOnline
          ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-200'
          : 'border-rose-200 bg-rose-50/95 text-rose-800 dark:border-rose-800 dark:bg-rose-950/95 dark:text-rose-200',
      )}
    >
      {isBackOnline ? (
        <Wifi className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="ml-2">{isBackOnline ? t(BACK_ONLINE_I18N_KEY) : t(OFFLINE_I18N_KEY)}</span>
    </div>
  )
}

export { OfflineBanner }
export { BACK_ONLINE_DISPLAY_MS, EXIT_ANIMATION_MS }
