import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Lock, Unlock, Settings } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { NavLink } from '@/shared/ui/NavLink'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'

function MobileNav() {
  const { t } = useTranslation(['common', 'crypto'])
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const lockVault = useCryptoStore((s) => s.lockVault)

  return (
    <nav
      aria-label={t('common:nav.mainNav')}
      className="border-sidebar-border bg-sidebar text-sidebar-foreground fixed right-0 bottom-0 left-0 z-40 border-t md:hidden"
    >
      <div className="flex items-center justify-around pb-[env(safe-area-inset-bottom)]">
        <NavLink
          to="/dashboard"
          className="[&.active]:text-sidebar-primary flex flex-col items-center gap-1 px-4 py-2 text-xs [&.active]:bg-transparent"
        >
          <LayoutDashboard className="size-5" />
          <span>{t('common:nav.dashboard')}</span>
        </NavLink>

        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mt-1"
          onClick={lockVault}
          aria-label={isVaultLocked ? t('crypto:vault.unlock') : t('crypto:vault.lock')}
        >
          {isVaultLocked ? <Unlock className="size-5" /> : <Lock className="size-5" />}
        </Button>

        <NavLink
          to="/settings"
          className="[&.active]:text-sidebar-primary flex flex-col items-center gap-1 px-4 py-2 text-xs [&.active]:bg-transparent"
        >
          <Settings className="size-5" />
          <span>{t('common:nav.settings')}</span>
        </NavLink>
      </div>
    </nav>
  )
}

export { MobileNav }
