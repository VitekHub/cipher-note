import { Link } from '@tanstack/react-router'

import { CipherNoteIcon } from '@/shared/ui/brand/CipherNoteIcon'
import { LanguageSwitcher } from '@/shared/ui/nav/LanguageSwitcher'
import { ThemeSwitcher } from '@/shared/ui/nav/ThemeSwitcher'

function PublicHeader() {
  return (
    <header className="fixed right-0 left-0 z-50 border-b border-transparent backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2" aria-label="Back to home">
          <CipherNoteIcon className="size-7" />
          <span className="text-foreground text-lg font-semibold">Cipher Note</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  )
}

export { PublicHeader }
