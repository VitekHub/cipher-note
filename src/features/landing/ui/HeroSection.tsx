import { useTranslation } from 'react-i18next'

import { CipherNoteIcon } from '@/shared/ui/brand/CipherNoteIcon'
import { CtaButtons } from '@/features/landing/ui/CtaButtons'

function HeroSection() {
  const { t } = useTranslation('landing')

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-32 text-center">
      <div className="animate-fade-in-up relative z-10 mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-center gap-3">
          <CipherNoteIcon className="size-14" />
          <span className="text-foreground text-3xl font-bold tracking-tight">Cipher Note</span>
        </div>

        <h1 className="text-foreground mb-6 text-4xl leading-[1.15] font-bold tracking-tight sm:text-5xl md:text-6xl">
          {t('hero.title')}
        </h1>

        <p className="text-muted-foreground mx-auto mb-12 max-w-2xl text-lg leading-relaxed sm:text-xl">
          {t('hero.subtitle')}
        </p>

        <CtaButtons />
      </div>
    </section>
  )
}

export { HeroSection }
