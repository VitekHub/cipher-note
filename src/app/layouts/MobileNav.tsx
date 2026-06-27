import { useTranslation } from 'react-i18next'
import { Lock, Unlock, Settings } from 'lucide-react'
import { useNavigate, useParams } from '@tanstack/react-router'

import { Button } from '@/shared/ui/button'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'
import { keyVault } from '@/shared/crypto/vault/key-vault'
import { useEntries } from '@/features/fields/model/use-entry'
import { EntryNavItem } from '@/app/layouts/EntryNavItem'
import { CreateEntryButton } from '@/features/fields/ui/CreateEntryButton'

function MobileNav() {
  const { t } = useTranslation(['common', 'vault'])
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const activeEntryId = 'entryId' in params ? params.entryId : undefined

  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const openUnlockDialog = useVaultDialogStore((s) => s.openUnlockDialog)
  const { data: entries } = useEntries()

  function handleVaultLock() {
    if (isVaultLocked) {
      openUnlockDialog()
    } else {
      keyVault.lockVault()
    }
  }

  return (
    <nav
      aria-label={t('common:nav.mainNav')}
      className="border-sidebar-border bg-sidebar text-sidebar-foreground fixed right-0 bottom-0 left-0 z-40 border-t md:hidden"
    >
      <div className="flex items-center justify-around pb-[env(safe-area-inset-bottom)]">
        {/* Entry shortcuts — show up to 3 entries */}
        {entries && entries.length > 0
          ? entries
              .slice(0, 3)
              .map((entry, index) => (
                <EntryNavItem
                  variant="mobile"
                  key={entry.id}
                  entryId={entry.id}
                  index={index}
                  isVaultLocked={isVaultLocked}
                  isActive={activeEntryId === entry.id}
                  onClick={() => navigate({ to: '/dashboard/$entryId', params: { entryId: entry.id } })}
                />
              ))
          : null}

        <CreateEntryButton
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        />

        {/* Vault lock/unlock */}
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleVaultLock}
          aria-label={isVaultLocked ? t('vault:unlock') : t('vault:lock')}
        >
          {isVaultLocked ? <Unlock className="size-5" /> : <Lock className="size-5" />}
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => navigate({ to: '/settings' })}
          aria-label={t('common:nav.settings')}
        >
          <Settings className="size-5" />
        </Button>
      </div>
    </nav>
  )
}

export { MobileNav }
