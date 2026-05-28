import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'

function PreAlphaBanner() {
  const { t } = useTranslation('common')

  return (
    <div className="fixed top-0 right-0 left-0 z-[100] flex justify-center px-4 pt-2">
      <div
        role="banner"
        aria-label={t('preAlpha.ariaLabel')}
        className="flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-50/95 px-4 py-1.5 text-sm text-amber-700 shadow-sm backdrop-blur-sm dark:border-amber-500/20 dark:bg-neutral-900/95 dark:text-amber-400"
      >
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        <span>{t('preAlpha.message')}</span>
      </div>
    </div>
  )
}

export { PreAlphaBanner }
