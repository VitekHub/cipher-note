import { useQuery } from '@tanstack/react-query'
import { DecryptionError } from '@/shared/crypto/errors'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useAuth } from '@/shared/auth/auth-context'
import { fieldService } from '@/features/fields/model/field-service'
import type { FieldName } from '@/shared/types/entities/field.types'

/**
 * Load and decrypt a single field's content.
 *
 * The query is disabled while vault is locked or field key missing. On lock,
 * crypto-store purges field queries so unlock triggers a fresh fetch.
 */
export function useField(fieldName: FieldName) {
  const userId = useAuth().user?.id ?? ''
  const enabled = useCryptoStore((s) => !s.isVaultLocked && s.loadedFieldKeys[fieldName] === true) && !!userId

  return useQuery({
    queryKey: ['field', fieldName],
    queryFn: () => fieldService.loadField(userId, fieldName),
    enabled,
    retry: (failureCount, error) => {
      if (error instanceof DecryptionError) return false
      return failureCount < 2
    },
  })
}
