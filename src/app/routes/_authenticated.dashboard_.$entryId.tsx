import { createFileRoute } from '@tanstack/react-router'

import { EntryDetailPage } from '@/features/fields/ui/DashboardPage'
import { LockedVaultCard } from '@/features/vault/ui/LockedVaultCard'
import { useEntryStatus } from '@/features/fields/model/use-entry-status'
import { ENTRY_STATUS } from '@/features/fields/model/entry-status'
import { EntryStatusBanner } from '@/features/fields/ui/EntryStatusBanner'

function EntryDetailRoute() {
  const { entryId } = Route.useParams()
  const entryStatus = useEntryStatus(entryId)

  if (entryStatus === ENTRY_STATUS.LOADING) return null

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <EntryStatusBanner status={entryStatus} />
      {entryStatus !== ENTRY_STATUS.NOT_FOUND && (
        <EntryDetailPage entryId={entryId} lockedFallback={<LockedVaultCard />} />
      )}
    </div>
  )
}

const Route = createFileRoute('/_authenticated/dashboard_/$entryId')({
  component: EntryDetailRoute,
})

export { Route }
