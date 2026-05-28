import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

function CtaButtons() {
  const { t } = useTranslation('landing')

  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <Link to="/register" className={cn(buttonVariants({ size: 'lg' }), 'h-12 px-8 text-base')}>
        {t('hero.cta')}
      </Link>
      <Link to="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 px-8 text-base')}>
        {t('hero.login')}
      </Link>
    </div>
  )
}

export { CtaButtons }
