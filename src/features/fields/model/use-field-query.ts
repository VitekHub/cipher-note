import { useQuery } from '@tanstack/react-query'
import { DecryptionError } from '@/shared/crypto/errors'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { fieldService } from '@/features/fields/model/field-service'
import type { FieldName } from '@/shared/types/entities/field.types'

/**
 * Load and decrypt a single field's content.
 *
 * The query is disabled while vault is locked or field key missing. On lock,
 * crypto-store purges field queries so unlock triggers a fresh fetch.
 */
export function useFieldQuery(entryId: string, fieldName: FieldName) {
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
