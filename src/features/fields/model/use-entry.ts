import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRequiredUserId } from '@/shared/auth/use-current-user'
import { entryService } from '@/features/fields/model/entry-service'
import type { ServerEntry } from '@/shared/types/entities/entry.types'

/** Fetch all entries for the current user. */
export function useEntries() {
  const userId = useRequiredUserId()
  return useQuery({
    queryKey: ['entries', userId],
    queryFn: () => entryService.fetchEntries(userId),
  })
}

/** Create a new entry. Invalidates the entry list on success. */
export function useCreateEntry() {
  const queryClient = useQueryClient()
  const userId = useRequiredUserId()

  return useMutation({
    mutationFn: () => entryService.createEntry(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', userId] })
    },
  })
}

/** Delete an entry. Removes the entry from cache and clears cached field data on success. */
export function useDeleteEntry() {
  const queryClient = useQueryClient()
  const userId = useRequiredUserId()

  return useMutation({
    mutationFn: (entryId: string) => entryService.deleteEntry(entryId),
    onSuccess: (_data, entryId) => {
      queryClient.removeQueries({ queryKey: ['field', entryId] })
    },
    onMutate: async (entryId) => {
      await queryClient.cancelQueries({ queryKey: ['entries', userId] })
      const previousEntries = queryClient.getQueryData<ServerEntry[]>(['entries', userId])
      queryClient.setQueryData(
        ['entries', userId],
        (old: ServerEntry[] | undefined) => old?.filter((e) => e.id !== entryId) ?? [],
      )
      return { previousEntries }
    },
    onError: (_err, _entryId, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(['entries', userId], context.previousEntries)
      }
    },
  })
}
