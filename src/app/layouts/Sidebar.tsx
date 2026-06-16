import { useTranslation } from 'react-i18next'
import { Settings, Lock, Unlock, LogOut, User, X } from 'lucide-react'
import { useNavigate, useParams } from '@tanstack/react-router'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import { AppLogo } from '@/shared/ui/brand/AppLogo'
import { NavLink } from '@/shared/ui/nav/NavLink'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'
import { keyVault } from '@/shared/crypto/key-vault'
import { useEntries } from '@/features/fields/model/use-entry'
import { CreateEntryButton } from '@/features/fields/ui/CreateEntryButton'
import { EntryNavItem } from '@/app/layouts/EntryNavItem'

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
  const openUnlockDialog = useVaultDialogStore((s) => s.openUnlockDialog)
  const { data: entries } = useEntries()

  function handleNavClick() {
    onClose?.()
  }

  async function handleLogout() {
    onClose?.()
    await onLogout?.()
    navigate({ to: '/login' })
  }

  function handleVaultLock() {
    onClose?.()
    if (isVaultLocked) {
      openUnlockDialog()
    } else {
      keyVault.lockVault()
    }
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
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <User className="size-4" />
              <span className="min-w-0 truncate">{user.username}</span>
            </div>
          )}

          {/* Logout button */}
          <Button variant="ghost" size="sm" className="px-4" onClick={handleLogout}>
            <LogOut className="size-4" />
            <span>{t('common:nav.logout')}</span>
          </Button>
        </div>

        {/* Vault lock button */}
        <Button variant="outline" size="sm" className="w-full" onClick={handleVaultLock}>
          {isVaultLocked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
          <span>{isVaultLocked ? t('vault:unlock') : t('vault:lock')}</span>
        </Button>
        {/* Settings */}
        <NavLink to="/settings" onClick={handleNavClick} className="flex items-center justify-center gap-3">
          <Settings className="size-4" />
          <span>{t('common:nav.settings')}</span>
        </NavLink>
      </div>
    </div>
  )
}

export { Sidebar }
