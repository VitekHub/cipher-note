import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { realtimeAdapter } from '@/shared/realtime/supabase-realtime'
import { useRequiredUserId } from '@/shared/auth/use-current-user'
import { queryKeys } from '@/shared/lib/query-keys'
import { keyVault } from '@/shared/crypto/key-vault'
import { DecryptionError } from '@/shared/crypto/errors'
import { useSyncStatusStore } from '@/features/fields/model/sync-status-store'
import { isLocalEcho, scheduleRemoteUpdateClear } from '@/shared/realtime/realtime-echo'
import type { ServerEncryptedField } from '@/shared/types/api.types'
import type { FieldName } from '@/shared/types/entities/field.types'

/** True if a save mutation is currently in-flight (pending) for (entryId, fieldName).
 *  Used to detect a remote change racing a local save (the conflict case). */
function hasPendingSave(queryClient: QueryClient, entryId: string, fieldName: FieldName): boolean {
  return (
    queryClient.getMutationCache().findAll({ mutationKey: queryKeys.field.save(entryId, fieldName), status: 'pending' })
      .length > 0
  )
}

/**
 * Subscribes to realtime changes while the authenticated shell is mounted.
 * Field change: echo-suppressed; remote updates show a 'remote-update' indicator.
 * Entry change: refresh sidebar. Key rotation: re-derive field key in-place, or lock vault on failure.
 * Errors are logged, never blocking.
 */
function useRealtimeSync(): void {
  const userId = useRequiredUserId()
  const queryClient = useQueryClient()
  const { t } = useTranslation('fields')

  const cbRef = useRef({ t, queryClient })
  useEffect(() => {
    cbRef.current = { t, queryClient }
  }, [t, queryClient])

  useEffect(() => {
    void realtimeAdapter.subscribe(userId, {
      onFieldChange: (data: ServerEncryptedField) => {
        const { t, queryClient } = cbRef.current
        // 1. Echo suppression: if this is our own write bouncing back, skip entirely.
        if (isLocalEcho(data.entryId, data.fieldName, data.updatedAt)) return

        // 2. Conflict: a local save is in flight — last-write-wins, don't invalidate.
        if (hasPendingSave(queryClient, data.entryId, data.fieldName)) {
          // A local save is in flight, it will overwrite the remote change
          // (last-write-wins). Don't invalidate now; onSettled will refetch
          // once the local save completes, landing on the local version.
          toast.info(t('realtime.conflict'), {
            id: `conflict:${data.entryId}:${data.fieldName}`,
          })
          return
        }

        // 3. Genuine remote update: show indicator and invalidate.
        useSyncStatusStore.getState().setStatus(data.entryId, data.fieldName, 'remote-update')
        scheduleRemoteUpdateClear(data.entryId, data.fieldName, () => {
          const current = useSyncStatusStore.getState().status[data.entryId]?.[data.fieldName]
          if (current === 'remote-update') {
            useSyncStatusStore.getState().setStatus(data.entryId, data.fieldName, 'idle')
          }
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.field.detail(data.entryId, data.fieldName) })
      },
      onEntryChange: (change) => {
        const { queryClient } = cbRef.current
        queryClient.invalidateQueries({ queryKey: queryKeys.entry.list(userId) })
        if (change.eventType === 'DELETE') {
          queryClient.removeQueries({ queryKey: queryKeys.field.byEntry(change.entryId) })
        }
      },
      onKeyRotation: (fieldName, newVersion) => {
        // Void IIFE: the type contract says void, so we must not return the
        // Promise. Any unhandled rejection is caught here, not by the adapter.
        void (async () => {
          const { t, queryClient } = cbRef.current
          try {
            await keyVault.syncFieldKeys(userId)
            // Invalidate all field queries — any entry's field could be affected
            queryClient.invalidateQueries({ queryKey: queryKeys.field.all })
            toast.success(t('realtime.keyRotationApplied', { field: fieldName, version: newVersion }))
          } catch (error) {
            if (error instanceof DecryptionError) {
              toast.error(t('realtime.keyRotationFailed'))
            } else {
              toast.error(t('realtime.keyRotationNetworkError'))
            }
          }
        })()
      },
      onError: (error) => {
        console.warn('Realtime subscription error', error)
      },
    })

    return () => {
      realtimeAdapter.unsubscribe()
    }
  }, [userId])

  return
}

export { useRealtimeSync }
