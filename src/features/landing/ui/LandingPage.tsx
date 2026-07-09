import { useTranslation } from 'react-i18next'

import { HeroSection } from '@/features/landing/ui/HeroSection'
import { FeaturesGrid } from '@/features/landing/ui/FeaturesGrid'
import { HowItWorks } from '@/features/landing/ui/HowItWorks'
import { SecurityBanner } from '@/features/landing/ui/SecurityBanner'
import { PublicHeader } from '@/shared/ui/nav/PublicHeader'

function LandingPage() {
  const { t } = useTranslation('landing')

  return (
    <div className="bg-background text-foreground relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)_0,transparent_70%)] opacity-[0.06]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,var(--color-primary)_0,transparent_50%)] opacity-[0.03]" />

      <PublicHeader />

      <main className="relative">
        <HeroSection />
        <FeaturesGrid />
        <HowItWorks />
        <SecurityBanner />
      </main>

      <footer className="border-border/50 relative border-t px-6 py-8 text-center">
        <p className="text-muted-foreground text-sm">{t('footer.tagline')}</p>
      </footer>
    </div>
  )
}

export default LandingPage
