import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRequiredUserId } from '@/shared/auth/use-current-user'
import { fieldService } from '@/features/fields/model/field-service'
import { DecryptionError } from '@/shared/crypto/errors'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import type { FieldName } from '@/shared/types/entities/field.types'

/** Callbacks for field save mutations. */
export interface SaveFieldCallbacks {
  onSuccess?: () => void
  onError?: () => void
}

/**
 * Load and decrypt a single field's content.
 *
 * The query is disabled while vault is locked or field key missing. On lock,
 * crypto-store purges field queries so unlock triggers a fresh fetch.
 */
export function useField(entryId: string, fieldName: FieldName) {
  const enabled = useCryptoStore((s) => !s.isVaultLocked && s.loadedFieldKeys[fieldName] === true) && !!entryId

  return useQuery({
    queryKey: ['field', entryId, fieldName],
    queryFn: () => fieldService.loadField(entryId, fieldName),
    enabled,
    retry: (failureCount, error) => {
      if (error instanceof DecryptionError) return false
      return failureCount < 2
    },
  })
}

/**
 * Save (encrypt + upload) a field's content.
 *
 * Optimistically updates the cache so the user sees their change immediately,
 * then confirms with the server. Rolls back on error.
 */
export function useSaveField(entryId: string, fieldName: FieldName) {
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
