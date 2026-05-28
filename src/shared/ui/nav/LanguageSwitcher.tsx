import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'

const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'cs', label: 'CS', name: 'Čeština' },
] as const

const LANGUAGE_ITEMS = LANGUAGES.map((lang) => ({
  value: lang.code,
  label: lang.name,
}))

const LANGUAGE_CODES = LANGUAGES.map((lang) => lang.code) as string[]

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full'
}

function LanguageSwitcher({ variant = 'compact' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation('common')

  const currentCode = i18n.language?.split('-')[0] ?? 'en'

  if (variant === 'full') {
    return (
      <SegmentedControl
        items={LANGUAGE_ITEMS}
        value={currentCode}
        onChange={(code) => void i18n.changeLanguage(code)}
        aria-label={t('nav.languageSelection')}
      />
    )
  }

  const currentIndex = LANGUAGE_CODES.indexOf(currentCode)
  const nextIndex = (currentIndex + 1) % LANGUAGE_CODES.length
  const nextCode = LANGUAGE_CODES[nextIndex]

  function toggleLanguage() {
    void i18n.changeLanguage(nextCode)
  }

  const currentLang = LANGUAGES.find((lang) => lang.code === currentCode) ?? LANGUAGES[0]

  return (
    <Button variant="ghost" size="sm" onClick={toggleLanguage} aria-label={t('nav.switchLanguage')}>
      {currentLang.label}
    </Button>
  )
}

export { LanguageSwitcher }
