import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { GithubIcon } from '@/shared/ui/brand/GithubIcon'
import { CipherNoteIcon } from '@/shared/ui/brand/CipherNoteIcon'
import { LanguageSwitcher } from '@/shared/ui/nav/LanguageSwitcher'
import { ThemeSwitcher } from '@/shared/ui/nav/ThemeSwitcher'

function PublicHeader() {
  const { t } = useTranslation('common')

  return (
    <header className="right-0 left-0 z-50 border-b border-transparent backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Link to="/" className="flex items-center gap-2" aria-label={t('nav.backToHome')}>
          <CipherNoteIcon className="size-7" />
          <span className="text-foreground text-lg font-semibold">Cipher Note</span>
        </Link>
        <div className="flex items-center gap-2">
          <a href={t('app.githubUrl')} target="_blank" rel="noopener noreferrer" aria-label={t('nav.github')}>
            <GithubIcon className="text-muted-foreground hover:text-foreground transition-colors" />
          </a>
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  )
}

export { PublicHeader }
