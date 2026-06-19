import { useState, useMemo } from 'react'

import { useEntries } from '@/features/fields/model/use-entry'
import { ENTRY_STATUS } from '@/features/fields/model/entry-status'
import type { EntryStatus } from '@/features/fields/model/entry-status'

/** Track whether an entryId is loading, valid, not found, or was deleted. */
export function useEntryStatus(entryId: string): EntryStatus {
  const { data: entries, isLoading } = useEntries()
  const [everValid, setEverValid] = useState(false)

  const isPresent = !isLoading && (entries?.some((e) => e.id === entryId) ?? false)
  if (isPresent && !everValid) {
    setEverValid(true)
  }

  return useMemo(() => {
    if (isLoading) return ENTRY_STATUS.LOADING
    if (isPresent) return ENTRY_STATUS.VALID
    if (everValid) return ENTRY_STATUS.DELETED
    return ENTRY_STATUS.NOT_FOUND
  }, [isLoading, isPresent, everValid])
}
