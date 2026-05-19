import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'cs', label: 'CS' },
] as const

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const currentCode = i18n.language?.split('-')[0] ?? 'en'
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
