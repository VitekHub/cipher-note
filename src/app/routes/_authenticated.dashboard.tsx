import { createFileRoute } from '@tanstack/react-router'

import { useEntries, useCreateEntry } from '@/features/fields/model/use-entry'
import { EmptyState, DashboardWelcome } from '@/features/fields/ui/DashboardPage'
import { LockedVaultCard } from '@/features/vault/ui/LockedVaultCard'
import { useNavigate } from '@tanstack/react-router'

function DashboardIndex() {
  const { data: entries, isLoading } = useEntries()
  const createEntry = useCreateEntry()
  const navigate = useNavigate()

  if (isLoading) return null

  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        onCreateEntry={() => {
          createEntry.mutate(undefined, {
            onSuccess: (newEntry) => {
              navigate({ to: '/dashboard/$entryId', params: { entryId: newEntry.id } })
            },
          })
        }}
        lockedFallback={<LockedVaultCard />}
      />
    )
  }

  return <DashboardWelcome />
}

const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardIndex,
})

export { Route }
