import { ShieldCheck, KeyRound, Fingerprint, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'

interface FeatureItem {
  icon: LucideIcon
  titleKey: string
  descriptionKey: string
}

const FEATURES: FeatureItem[] = [
  { icon: ShieldCheck, titleKey: 'features.zeroKnowledge.title', descriptionKey: 'features.zeroKnowledge.description' },
  { icon: KeyRound, titleKey: 'features.splitKey.title', descriptionKey: 'features.splitKey.description' },
  { icon: Fingerprint, titleKey: 'features.recovery.title', descriptionKey: 'features.recovery.description' },
  { icon: Lock, titleKey: 'features.openDesign.title', descriptionKey: 'features.openDesign.description' },
]

function FeaturesGrid() {
  const { t } = useTranslation('landing')

  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-foreground mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          {t('features.heading')}
        </h2>

        <div className="grid gap-8 sm:grid-cols-2 lg:gap-12">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.titleKey} feature={feature} t={t} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ feature, t }: { feature: FeatureItem; t: (key: string) => string }) {
  const Icon = feature.icon

  return (
    <div className="bg-card/50 border-border/50 group hover:border-primary/20 hover:shadow-primary/5 rounded-xl border p-8 backdrop-blur-sm transition-all duration-300 hover:shadow-lg">
      <div className="bg-primary/10 text-primary mb-5 inline-flex rounded-lg p-3">
        <Icon className="size-6" />
      </div>
      <h3 className="text-foreground mb-3 text-lg font-semibold">{t(feature.titleKey)}</h3>
      <p className="text-muted-foreground leading-relaxed">{t(feature.descriptionKey)}</p>
    </div>
  )
}

export { FeaturesGrid }
