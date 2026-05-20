import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'

const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'cs', label: 'CS', name: 'Čeština' },
] as const

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full'
}

function LanguageSwitcher({ variant = 'compact' }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation('settings')

  const currentCode = i18n.language?.split('-')[0] ?? 'en'

  if (variant === 'full') {
    return (
      <div className="flex gap-1">
        {LANGUAGES.map((lang) => (
          <Button
            key={lang.code}
            variant={currentCode === lang.code ? 'default' : 'outline'}
            aria-current={currentCode === lang.code ? 'true' : undefined}
            size="sm"
            onClick={() => void i18n.changeLanguage(lang.code)}
          >
            {t(`preferences.languageName.${lang.code}`, lang.name)}
          </Button>
        ))}
      </div>
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
