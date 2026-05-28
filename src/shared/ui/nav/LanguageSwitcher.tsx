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

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full'
}

function LanguageSwitcher({ variant = 'compact' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation('settings')

  const currentCode = i18n.language?.split('-')[0] ?? 'en'

  if (variant === 'full') {
    return (
      <SegmentedControl
        items={LANGUAGE_ITEMS}
        value={currentCode}
        onChange={(code) => void i18n.changeLanguage(code)}
      />
    )
  }

  const currentLang = LANGUAGES.find((lang) => lang.code === currentCode) ?? LANGUAGES[0]
  const nextLang = LANGUAGES.find((lang) => lang.code !== currentLang.code) ?? LANGUAGES[0]

  function toggleLanguage() {
    void i18n.changeLanguage(nextLang.code)
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggleLanguage}>
      {currentLang.label}
    </Button>
  )
}

export { LanguageSwitcher }
