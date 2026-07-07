import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { useEntries, useCreateEntry } from '@/features/fields/model/use-entry'
import { EmptyState, DashboardWelcome } from '@/features/fields/ui/DashboardPage'
import { LockedVaultCard } from '@/features/vault/ui/LockedVaultCard'
import { DashboardSkeleton } from '@/app/Pending'
import { ErrorState } from '@/shared/ui/ErrorState'

function DashboardIndex() {
  const { data: entries, isLoading, isError, refetch } = useEntries()
  const createEntry = useCreateEntry()
  const navigate = useNavigate()

  if (isLoading) return <DashboardSkeleton />
  if (isError)
    return (
      <ErrorState title="common:status.error" description="entries:errors.loadFailed" onRetry={() => void refetch()} />
    )

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
