import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { realtimeAdapter } from '@/shared/realtime/supabase-realtime'
import { useRequiredUserId } from '@/shared/auth/use-current-user'
import { queryKeys } from '@/shared/lib/query-keys'
import { keyVault } from '@/shared/crypto/key-vault'
import type { ServerEncryptedField } from '@/shared/types/api.types'
import type { FieldName } from '@/shared/types/entities/field.types'

/** Structural equality for two mutationKey arrays — both from `queryKeys.field.save(...)`. */
function isSameMutationKey(a: unknown, b: readonly unknown[]): boolean {
  if (!Array.isArray(a) || a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

/** True if a save mutation is currently in-flight (pending) for (entryId, fieldName).
 *  Used to detect a remote change racing a local save (the conflict case). */
function hasPendingSave(queryClient: QueryClient, entryId: string, fieldName: FieldName): boolean {
  const mutationKey: readonly unknown[] = queryKeys.field.save(entryId, fieldName)
  return queryClient
    .getMutationCache()
    .getAll()
    .some(
      (mutation) => mutation.state.status === 'pending' && isSameMutationKey(mutation.options.mutationKey, mutationKey),
    )
}

/**
 * Subscribes to realtime changes while the authenticated shell is mounted.
 * Field change: conflict-toast with "Use remote" action if a local save is pending, else invalidate.
 * Entry change: refresh sidebar. Key rotation: re-derive field key in-place, or lock vault on failure.
 * Errors are logged, never blocking.
 */
function useRealtimeSync(): void {
  const userId = useRequiredUserId()
  const queryClient = useQueryClient()
  const { t } = useTranslation('fields')

  useEffect(() => {
    void realtimeAdapter.subscribe(userId, {
      onFieldChange: (_fieldName, data: ServerEncryptedField) => {
        if (hasPendingSave(queryClient, data.entryId, data.fieldName)) {
          toast.warning(t('realtime.conflict'), {
            action: {
              label: t('realtime.conflictUseRemote'),
              onClick: () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.field.detail(data.entryId, data.fieldName) })
              },
            },
          })
          return
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.field.detail(data.entryId, data.fieldName) })
      },
      onEntryChange: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.entry.list(userId) })
      },
      onKeyRotation: async (fieldName, newVersion) => {
        try {
          await keyVault.syncFieldKeys(userId)
          // Invalidate all field queries — any entry's field could be affected
          await queryClient.invalidateQueries({ queryKey: queryKeys.field.all })
          toast.success(t('realtime.keyRotationApplied', { field: fieldName, version: newVersion }))
        } catch {
          toast.error(t('realtime.keyRotationFailed'))
        }
      },
      onError: (error) => {
        console.warn('Realtime subscription error', error)
      },
    })

    return () => {
      realtimeAdapter.unsubscribe()
    }
  }, [userId, queryClient, t])

  return
}

export { useRealtimeSync }
