import { useMutation, useQueryClient } from '@tanstack/react-query'
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

  return useMutation({
    mutationFn: (plaintext: string) => fieldService.saveField(fieldName, plaintext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field', fieldName] })
    },
  })
}
