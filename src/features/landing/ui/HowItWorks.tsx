import { UserPlus, PenLine, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'

interface Step {
  icon: LucideIcon
  titleKey: string
  descriptionKey: string
}

const STEPS: Step[] = [
  { icon: UserPlus, titleKey: 'howItWorks.step1.title', descriptionKey: 'howItWorks.step1.description' },
  { icon: PenLine, titleKey: 'howItWorks.step2.title', descriptionKey: 'howItWorks.step2.description' },
  { icon: ShieldCheck, titleKey: 'howItWorks.step3.title', descriptionKey: 'howItWorks.step3.description' },
]

function HowItWorks() {
  const { t } = useTranslation('landing')

  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-foreground mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          {t('howItWorks.heading')}
        </h2>

        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, index) => (
            <StepCard key={step.titleKey} step={step} index={index} last={index === STEPS.length - 1} t={t} />
          ))}
        </div>
      </div>
    </section>
  )
}

interface StepCardProps {
  step: Step
  index: number
  last: boolean
  t: (key: string) => string
}

function StepCard({ step, index, last, t }: StepCardProps) {
  const Icon = step.icon

  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-muted-foreground/30 mb-2 font-mono text-5xl leading-none font-bold select-none">
        {index + 1}
      </span>
      <div className="relative mb-8 flex w-full items-center justify-center">
        {!last && (
          <div className="from-border via-primary/40 to-border absolute left-1/2 hidden h-px w-full bg-gradient-to-r md:block" />
        )}
        <div className="bg-primary text-primary-foreground shadow-primary/20 relative z-10 flex size-14 items-center justify-center rounded-full shadow-lg">
          <Icon className="size-6" />
        </div>
      </div>
      <h3 className="text-foreground mb-3 text-lg font-semibold">{t(step.titleKey)}</h3>
      <p className="text-muted-foreground leading-relaxed">{t(step.descriptionKey)}</p>
    </div>
  )
}

export { HowItWorks }
