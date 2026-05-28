import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'

function PreAlphaBanner() {
  const { t } = useTranslation('common')

  return (
    <div className="flex justify-center bg-amber-50/95 dark:bg-neutral-900/95">
      <div
        role="banner"
        aria-label={t('preAlpha.ariaLabel')}
        className="flex items-center gap-2 px-4 py-1.5 text-sm text-amber-900 backdrop-blur-sm dark:text-amber-200"
      >
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        <span>{t('preAlpha.message')}</span>
      </div>
    </div>
  )
}

export { PreAlphaBanner }
