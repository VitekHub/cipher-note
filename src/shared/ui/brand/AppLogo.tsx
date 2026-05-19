import { useTranslation } from 'react-i18next'

import { CipherNoteIcon } from '@/shared/ui/brand/CipherNoteIcon'
import { cn } from '@/shared/lib/utils'

function AppLogo({ className }: { className?: string }) {
  const { t } = useTranslation('common')

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <CipherNoteIcon className="size-8" />
      <span className="text-lg font-semibold">{t('app.name')}</span>
    </div>
  )
}

export { AppLogo }
