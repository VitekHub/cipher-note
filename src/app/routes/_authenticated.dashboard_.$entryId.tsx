import { createFileRoute } from '@tanstack/react-router'

import { EntryDetailPage } from '@/features/fields/ui/DashboardPage'
import { LockedVaultCard } from '@/features/vault/ui/LockedVaultCard'

function EntryDetailRoute() {
  const { entryId } = Route.useParams()
  return <EntryDetailPage entryId={entryId} lockedFallback={<LockedVaultCard />} />
}

const Route = createFileRoute('/_authenticated/dashboard_/$entryId')({
  component: EntryDetailRoute,
})

export { Route }
