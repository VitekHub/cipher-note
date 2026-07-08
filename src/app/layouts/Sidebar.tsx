import { useTranslation } from 'react-i18next'
import { Settings, LogOut, User, X } from 'lucide-react'
import { useNavigate, useParams } from '@tanstack/react-router'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import { AppLogo } from '@/shared/ui/brand/AppLogo'
import { NavLink } from '@/shared/ui/nav/NavLink'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useEntries } from '@/features/fields/model/use-entry'
import { CreateEntryButton } from '@/features/fields/ui/CreateEntryButton'
import { EntryNavItem } from '@/app/layouts/EntryNavItem'
import { VaultLockButton } from '@/app/layouts/VaultLockButton'

interface SidebarProps {
  onClose?: () => void
  onLogout?: () => Promise<void>
  className?: string
}

function Sidebar({ onClose, onLogout, className }: SidebarProps) {
  const { t } = useTranslation(['common', 'vault'])
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const activeEntryId = 'entryId' in params ? params.entryId : undefined

  const user = useAuthStore((s) => s.user)
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const { data: entries } = useEntries()

  function handleNavClick() {
    onClose?.()
  }

  async function handleLogout() {
    onClose?.()
    await onLogout?.()
    navigate({ to: '/login' })
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="border-sidebar-border flex min-h-14 items-center justify-between border-b px-4">
        <AppLogo />
        {onClose && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label={t('common:nav.closeMenu')}
            data-testid="sidebar-close"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Entry list */}
      <nav aria-label={t('common:nav.mainNav')} className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {t('entries:entriesLabel')}
          </span>
          <CreateEntryButton onCreated={onClose} />
        </div>

        {entries && entries.length > 0 ? (
          <div className="space-y-0.5">
            {entries.map((entry, index) => (
              <EntryNavItem
                variant="sidebar"
                key={entry.id}
                entryId={entry.id}
                index={index}
                isVaultLocked={isVaultLocked}
                isActive={activeEntryId === entry.id}
                onClick={() => {
                  navigate({ to: '/dashboard/$entryId', params: { entryId: entry.id } })
                  handleNavClick()
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground px-3 py-2 text-sm">{t('entries:empty')}</p>
        )}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          {/* User info */}
          {user && (
            <div className="text-muted-foreground flex min-w-0 flex-1 items-center gap-2 text-sm">
              <User className="size-4" />
              <span className="min-w-0 truncate" title={user.username}>{user.username}</span>
            </div>
          )}

          {/* Logout button */}
          <Button variant="ghost" size="sm" className="px-4" onClick={handleLogout} data-testid="logout-button">
            <LogOut className="size-4" />
            <span>{t('common:nav.logout')}</span>
          </Button>
        </div>

        {/* Vault lock button */}
        <VaultLockButton variant="label" onBeforeToggle={onClose} className="w-full" />
        {/* Settings */}
        <NavLink
          to="/settings"
          onClick={handleNavClick}
          className="flex items-center justify-center gap-3"
          data-testid="nav-settings"
        >
          <Settings className="size-4" />
          <span>{t('common:nav.settings')}</span>
        </NavLink>
      </div>
    </div>
  )
}

export { Sidebar }
