import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/shared/auth/auth-context'
import { fieldService } from '@/features/fields/model/field-service'
import type { FieldName } from '@/shared/types/entities/field.types'

/**
 * Save (encrypt + upload) a field's content.
 *
 * On success, invalidates the field query so the next read reflects
 * the confirmed server state.
 */
export function useSaveField(fieldName: FieldName) {
  const queryClient = useQueryClient()
  const userId = useAuth().user?.id ?? ''

  return useMutation({
    mutationFn: (plaintext: string) => fieldService.saveField(userId, fieldName, plaintext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field', fieldName] })
    },
  })
}
