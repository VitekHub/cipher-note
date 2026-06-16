import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { useEntries, useCreateEntry } from '@/features/fields/model/use-entry'
import { EmptyState } from '@/features/fields/ui/DashboardPage'
import { LockedVaultCard } from '@/features/vault/ui/LockedVaultCard'

function DashboardIndex() {
  const { data: entries, isLoading } = useEntries()
  const createEntry = useCreateEntry()
  const navigate = useNavigate()
  const hasRedirected = useRef(false)

  // Redirect to the first entry only on the initial load, not on subsequent refetches
  useEffect(() => {
    if (!hasRedirected.current && entries && entries.length > 0) {
      hasRedirected.current = true
      navigate({ to: '/dashboard/$entryId', params: { entryId: entries[0].id }, replace: true })
    }
  }, [entries, navigate])

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

  return null
}

const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardIndex,
})

export { Route }
