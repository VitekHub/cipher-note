import { useTranslation } from 'react-i18next'
import { Zap } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

function AppLogo({ className }: { className?: string }) {
  const { t } = useTranslation('common')

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Zap className="text-sidebar-primary size-5" />
      <span className="text-lg font-semibold">{t('app.name')}</span>
    </div>
  )
}

export { AppLogo }
