import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { realtimeAdapter } from '@/shared/realtime/supabase-realtime'
import { useRequiredUserId } from '@/shared/auth/use-current-user'
import type { ServerEncryptedField } from '@/shared/types/api.types'
import type { FieldName } from '@/shared/types/entities/field.types'

/** Structural equality for two mutationKey arrays — both `['field', entryId, fieldName]`. */
function isSameMutationKey(a: unknown, b: readonly unknown[]): boolean {
  if (!Array.isArray(a) || a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

/** True if a save mutation is currently in-flight (pending) for (entryId, fieldName).
 *  Used to detect a remote change racing a local save (the conflict case). */
function hasPendingSave(queryClient: QueryClient, entryId: string, fieldName: FieldName): boolean {
  const mutationKey: readonly unknown[] = ['field', entryId, fieldName]
  return queryClient
    .getMutationCache()
    .getAll()
    .some(
      (mutation) => mutation.state.status === 'pending' && isSameMutationKey(mutation.options.mutationKey, mutationKey),
    )
}

/**
 * Subscribes to realtime changes while the authenticated shell is mounted.
 * Field change: conflict-toast if a local save is pending, else invalidate.
 * Entry change: refresh sidebar. Key rotation: toast only (no producer yet).
 * Errors are logged, never blocking. Vault-locked invalidates are no-ops.
 */
function useRealtimeSync(): void {
  const userId = useRequiredUserId()
  const queryClient = useQueryClient()
  const { t } = useTranslation('fields')

  useEffect(() => {
    void realtimeAdapter.subscribe(userId, {
      onFieldChange: (_fieldName, data: ServerEncryptedField) => {
        if (hasPendingSave(queryClient, data.entryId, data.fieldName)) {
          toast.warning(t('realtime.conflict'))
          return
        }
        queryClient.invalidateQueries({ queryKey: ['field', data.entryId, data.fieldName] })
      },
      onEntryChange: () => {
        queryClient.invalidateQueries({ queryKey: ['entries', userId] })
      },
      onKeyRotation: (fieldName, newVersion) => {
        toast.info(t('realtime.keyRotation', { field: fieldName, version: newVersion }))
      },
      onError: (error) => {
        console.warn('Realtime subscription error', error)
      },
    })

    return () => {
      realtimeAdapter.unsubscribe()
    }
  }, [userId, queryClient, t])
}

export { useRealtimeSync }
