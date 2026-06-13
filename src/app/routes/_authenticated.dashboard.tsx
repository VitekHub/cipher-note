import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useEntries, useCreateEntry } from '@/features/fields/model/use-entries'
import { EmptyState } from '@/features/fields/ui/DashboardPage'

function DashboardIndex() {
  const { data: entries, isLoading } = useEntries()
  const createEntry = useCreateEntry()
  const navigate = useNavigate()

  // When entries load and we have at least one, redirect to the first entry
  useEffect(() => {
    if (entries && entries.length > 0) {
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
      />
    )
  }

  return null
}

const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardIndex,
})

export { Route }
