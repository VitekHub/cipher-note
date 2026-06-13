import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/auth/auth-context'
import { entryService } from '@/features/fields/model/entry-service'

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

/** Delete an entry. Invalidates the entry list and removes cached field data on success. */
export function useDeleteEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entryId: string) => entryService.deleteEntry(entryId),
    onSuccess: (_data, entryId) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.removeQueries({ queryKey: ['field', entryId] })
    },
  })
}
