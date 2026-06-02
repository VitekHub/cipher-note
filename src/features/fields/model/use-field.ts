import { useQuery } from '@tanstack/react-query'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { fieldService } from '@/features/fields/model/field-service'
import type { FieldName } from '@/shared/types/entities/field.types'

/**
 * Load and decrypt a single field's content.
 *
 * The query is disabled while the vault is locked or the field key is not loaded.
 * When the vault locks, crypto-store purges all ['field'] queries from the cache,
 * so the next unlock triggers a fresh fetch.
 */
export function useField(fieldName: FieldName) {
  const isVaultLocked = useCryptoStore((s) => s.isVaultLocked)
  const hasFieldKey = useCryptoStore((s) => s.loadedFieldKeys[fieldName] === true)

  return useQuery({
    queryKey: ['field', fieldName],
    queryFn: () => fieldService.loadField(fieldName),
    enabled: !isVaultLocked && hasFieldKey,
  })
}
