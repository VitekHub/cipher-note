import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/auth/auth-context'
import { entryService } from '@/features/fields/model/entry-service'
import type { ServerEntry } from '@/shared/types/entities/entry.types'

/** Fetch all entries for the current user. Enabled when authenticated. */
export function useEntries() {
  const userId = useAuth().user?.id ?? ''
  return useQuery({
    queryKey: ['entries', userId],
    queryFn: () => entryService.fetchEntries(userId),
    enabled: !!userId,
  })
}

/** Create a new entry. Invalidates the entry list on success. */
export function useCreateEntry() {
  const queryClient = useQueryClient()
  const userId = useAuth().user?.id ?? ''

  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('useCreateEntry requires an authenticated user')
      return entryService.createEntry(userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })
}

/** Delete an entry. Removes the entry from cache and clears cached field data on success. */
export function useDeleteEntry() {
  const queryClient = useQueryClient()
  const userId = useAuth().user?.id ?? ''

  return useMutation({
    mutationFn: (entryId: string) => entryService.deleteEntry(entryId),
    onSuccess: (_data, entryId) => {
      queryClient.setQueryData(
        ['entries', userId],
        (old: ServerEntry[] | undefined) => old?.filter((e) => e.id !== entryId) ?? [],
      )
      queryClient.removeQueries({ queryKey: ['field', entryId] })
    },
  })
}
