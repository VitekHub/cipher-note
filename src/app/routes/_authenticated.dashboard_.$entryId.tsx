import { createFileRoute } from '@tanstack/react-router'

import { EntryDetailPage } from '@/features/fields/ui/DashboardPage'

function EntryDetailRoute() {
  const { entryId } = Route.useParams()
  return <EntryDetailPage entryId={entryId} />
}

const Route = createFileRoute('/_authenticated/dashboard_/$entryId')({
  component: EntryDetailRoute,
})

export { Route }
