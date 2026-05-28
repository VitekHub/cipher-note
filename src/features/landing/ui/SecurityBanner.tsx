import { useTranslation } from 'react-i18next'

import { CtaButtons } from '@/features/landing/ui/CtaButtons'

function SecurityBanner() {
  const { t } = useTranslation('landing')

  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-32">
      <div className="bg-card/60 border-border/50 mx-auto max-w-4xl rounded-2xl border p-12 text-center backdrop-blur-sm sm:p-16">
        <p className="text-muted-foreground mx-auto mb-10 max-w-xl text-lg leading-relaxed font-medium sm:text-xl">
          {t('security.statement')}
        </p>

        <CtaButtons />
      </div>
    </section>
  )
}

export { SecurityBanner }
