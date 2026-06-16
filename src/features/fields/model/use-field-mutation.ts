import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRequiredUserId } from '@/shared/auth/use-current-user'
import { fieldService } from '@/features/fields/model/field-service'
import type { FieldName } from '@/shared/types/entities/field.types'

/** Callbacks for field save mutations. */
export interface SaveFieldCallbacks {
  onSuccess?: () => void
  onError?: () => void
}

/**
 * Save (encrypt + upload) a field's content.
 *
 * Optimistically updates the cache so the user sees their change immediately,
 * then confirms with the server. Rolls back on error.
 */
export function useFieldMutation(entryId: string, fieldName: FieldName) {
  const queryClient = useQueryClient()
  const userId = useRequiredUserId()
  const queryKey = ['field', entryId, fieldName] as const

  return useMutation({
    networkMode: 'online', // pause mutations when offline; auto-resume when back online
    mutationFn: (plaintext: string) => fieldService.saveField({ userId, entryId, fieldName, plaintext }),
    onMutate: async (plaintext) => {
      await queryClient.cancelQueries({ queryKey })
      const previousValue = queryClient.getQueryData<string | null>(queryKey)
      queryClient.setQueryData(queryKey, plaintext)
      return { previousValue }
    },
    onError: (_err, _plaintext, context) => {
      if (context?.previousValue !== undefined) {
        queryClient.setQueryData(queryKey, context.previousValue)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
