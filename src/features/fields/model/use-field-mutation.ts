import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/auth/auth-context'
import { fieldService } from '@/features/fields/model/field-service'
import type { FieldName } from '@/shared/types/entities/field.types'

/**
 * Save (encrypt + upload) a field's content.
 *
 * Optimistically updates the cache so the user sees their change immediately,
 * then confirms with the server. Rolls back on error.
 */
export function useFieldMutation(fieldName: FieldName) {
  const queryClient = useQueryClient()
  const userId = useAuth().user?.id ?? ''
  const queryKey = ['field', fieldName] as const

  return useMutation({
    networkMode: 'offlineFirst', // run mutation even when offline, so errors surface immediately
    mutationFn: (plaintext: string) => {
      if (!userId) throw new Error('useFieldMutation requires an authenticated user')
      return fieldService.saveField(userId, fieldName, plaintext)
    },
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
