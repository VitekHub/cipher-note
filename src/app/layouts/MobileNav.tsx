import { useTranslation } from 'react-i18next'
import { Lock, Unlock, Settings, FileText } from 'lucide-react'
import { useNavigate, useParams } from '@tanstack/react-router'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/shared/crypto/vault-dialog-store'
import { keyVault } from '@/shared/crypto/key-vault'
import { useEntries } from '@/features/fields/model/use-entries'
import { useFieldQuery } from '@/features/fields/model/use-field-query'
import { CreateEntryButton } from '@/features/fields/ui/CreateEntryButton'

function MobileEntryItem({
  entryId,
  index,
  isVaultLocked,
  isActive,
  onClick,
}: {
  entryId: string
  index: number
  isVaultLocked: boolean
  isActive: boolean
  onClick: () => void
}) {
  const { t } = useTranslation('common')
  const { data: title } = useFieldQuery(entryId, 'title')
  const label = isVaultLocked
    ? t('entries.entryLabel', { number: index + 1 })
    : title || t('entries.entryLabel', { number: index + 1 })

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 px-2 py-1 text-xs',
        isActive ? 'bg-muted' : 'hover:bg-muted/50 text-muted-foreground',
      )}
    >
      <FileText className="size-5" />
      <span className="max-w-16 min-w-0 truncate text-[10px] leading-tight">{label}</span>
    </button>
  )
}

function MobileNav() {
  const { t } = useTranslation(['common', 'crypto'])
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const activeEntryId = (params as { entryId?: string }).entryId

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
                <MobileEntryItem
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
          aria-label={isVaultLocked ? t('crypto:vault.unlock') : t('crypto:vault.lock')}
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
