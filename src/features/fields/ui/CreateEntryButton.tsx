import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useCreateEntry } from '@/features/fields/model/use-entry'

interface CreateEntryButtonProps {
  onCreated?: () => void
  size?: 'icon-xs' | 'icon' | 'icon-sm' | 'icon-lg'
  className?: string
}

function CreateEntryButton({ onCreated, size = 'icon-sm', className }: CreateEntryButtonProps) {
  const { t } = useTranslation('entries')
  const navigate = useNavigate()
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const createEntry = useCreateEntry()

  function handleCreateEntry() {
    createEntry.mutate(undefined, {
      onSuccess: (newEntry) => {
        navigate({ to: '/dashboard/$entryId', params: { entryId: newEntry.id } })
        onCreated?.()
      },
    })
  }

  return (
    <Button
      variant="ghost"
      size={size}
      className={cn(className)}
      onClick={handleCreateEntry}
      aria-label={t('create')}
      disabled={isVaultLocked || createEntry.isPending}
    >
      <Plus />
    </Button>
  )
}

export { CreateEntryButton }
