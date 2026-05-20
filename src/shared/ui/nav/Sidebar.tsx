import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Settings, Lock, Unlock, LogOut, User, X } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { NavLink } from '@/shared/ui/nav/NavLink'
import { Separator } from '@/shared/ui/separator'
import { AppLogo } from '@/shared/ui/brand/AppLogo'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { logoutUser } from '@/features/auth/model/auth-credentials'

interface SidebarProps {
  onClose?: () => void
  className?: string
}

function Sidebar({ onClose, className }: SidebarProps) {
  const { t } = useTranslation(['common', 'crypto'])
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const toggleVaultLock = useCryptoStore((s) => s.toggleVaultLock)

  function handleNavClick() {
    onClose?.()
  }

  async function handleLogout() {
    onClose?.()
    await logoutUser()
    navigate({ to: '/login' })
  }

  function handleVaultLock() {
    // TEMP: flip vault locked state for manual testing (fix in Step 22)
    toggleVaultLock()
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
      <nav aria-label={t('common:nav.mainNav')} className="flex-1 space-y-1 p-2">
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
            <span className="min-w-0 truncate">{user.username}</span>
          </div>
        )}

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
