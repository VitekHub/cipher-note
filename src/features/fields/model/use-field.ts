import { useQuery } from '@tanstack/react-query'
import { DecryptionError } from '@/shared/crypto/errors'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { fieldService } from '@/features/fields/model/field-service'
import type { FieldName } from '@/shared/types/entities/field.types'

/**
 * Load and decrypt a single field's content.
 *
 * The query is disabled while vault is locked or field key missing. On lock,
 * crypto-store purges field queries so unlock triggers a fresh fetch.
 */
export function useField(fieldName: FieldName) {
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const hasFieldKey = useCryptoStore((s) => s.loadedFieldKeys[fieldName] === true)

  return useQuery({
    queryKey: ['field', fieldName],
    queryFn: () => fieldService.loadField(fieldName),
    enabled: !isVaultLocked && hasFieldKey,
    retry: (failureCount, error) => {
      if (error instanceof DecryptionError) return false
      return failureCount < 2
    },
  })
}
