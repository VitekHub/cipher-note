import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Settings, Lock, Unlock, LogOut, User, X } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { NavLink } from '@/shared/ui/NavLink'
import { Separator } from '@/shared/ui/separator'
import { AppLogo } from '@/shared/ui/AppLogo'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { logoutUser } from '@/features/auth/model/auth-credentials'

interface SidebarProps {
  onClose?: () => void
  className?: string
}

function Sidebar({ onClose, className }: SidebarProps) {
  const { t } = useTranslation(['common', 'crypto'])
  const user = useAuthStore((s) => s.user)
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const lockVault = useCryptoStore((s) => s.lockVault)

  function handleNavClick() {
    onClose?.()
  }

  async function handleLogout() {
    onClose?.()
    await logoutUser()
  }

  function handleVaultLock() {
    lockVault()
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <AppLogo />
        {onClose && (
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label={t('common:nav.closeMenu')}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        <NavLink to="/dashboard" onClick={handleNavClick} className="flex items-center gap-3">
          <LayoutDashboard className="size-4" />
          <span>{t('common:nav.dashboard')}</span>
        </NavLink>
        <NavLink to="/settings" onClick={handleNavClick} className="flex items-center gap-3">
          <Settings className="size-4" />
          <span>{t('common:nav.settings')}</span>
        </NavLink>
      </nav>

      <Separator />

      {/* Footer */}
      <div className="space-y-2 p-4">
        {/* User info */}
        {user && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <User className="size-4" />
            <span>{user.username}</span>
          </div>
        )}

        {/* Language switcher */}
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
        </div>

        {/* Vault lock button */}
        <Button variant="outline" size="sm" className="w-full" onClick={handleVaultLock}>
          {isVaultLocked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
          <span>{isVaultLocked ? t('crypto:vault.unlock') : t('crypto:vault.lock')}</span>
        </Button>

        {/* Logout button */}
        <Button variant="ghost" size="sm" className="w-full" onClick={handleLogout}>
          <LogOut className="size-4" />
          <span>{t('common:nav.logout')}</span>
        </Button>
      </div>
    </div>
  )
}

export { Sidebar }
