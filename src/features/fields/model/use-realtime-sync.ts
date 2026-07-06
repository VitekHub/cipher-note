import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useSyncStatusStore, SYNC_STATUS } from '@/features/fields/model/sync-status-store'
import { realtimeAdapter } from '@/shared/realtime/supabase-realtime'
import { useRequiredUserId } from '@/shared/auth/use-current-user'
import { queryKeys } from '@/shared/lib/query-keys'
import { keyVault } from '@/shared/crypto/vault/key-vault'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { isLocalEcho, scheduleRemoteUpdateClear, isLocalKeyRotationEcho } from '@/shared/realtime/realtime-echo'
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
        if (useCryptoStore.getState().isVaultLocked) return

        // 1. Echo suppression: if this is our own write bouncing back, skip entirely
        if (isLocalEcho(data.entryId, data.fieldName, data.updatedAt)) return

        // 2. Conflict: a local save is in flight, last-write-wins, don't invalidate.
        if (hasPendingSave(queryClient, data.entryId, data.fieldName)) {
          toast.info(t('realtime.conflict'), {
            id: `conflict:${data.entryId}:${data.fieldName}`,
          })
          return
        }

        // 3. Genuine remote update: show indicator and invalidate
        useSyncStatusStore.getState().setStatus(data.entryId, data.fieldName, SYNC_STATUS.REMOTE_UPDATE)
        scheduleRemoteUpdateClear(data.entryId, data.fieldName, () => {
          const current = useSyncStatusStore.getState().status[data.entryId]?.[data.fieldName]
          if (current === SYNC_STATUS.REMOTE_UPDATE) {
            useSyncStatusStore.getState().setStatus(data.entryId, data.fieldName, SYNC_STATUS.IDLE)
          }
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.field.detail(data.entryId, data.fieldName) })
      },
      onEntryChange: (change) => {
        const { queryClient } = cbRef.current
        if (useCryptoStore.getState().isVaultLocked) return
        queryClient.invalidateQueries({ queryKey: queryKeys.entry.list(userId) })
        if (change.eventType === 'DELETE') {
          queryClient.removeQueries({ queryKey: queryKeys.field.byEntry(change.entryId) })
        }
      },
      onKeyRotation: (fieldName, newVersion) => {
        // Vault is locked: no KEK to refresh field keys. Clear the cached
        // envelope so the next unlock fetches fresh key material from the
        // server (the rotation may have changed field keys).
        if (useCryptoStore.getState().isVaultLocked) {
          useCryptoStore.getState().clearCachedEnvelope()
          return
        }

        // Void IIFE: the type contract says void, so we must not return the
        // Promise. Any unhandled rejection is caught here, not by the adapter
        void (async () => {
          const { t, queryClient } = cbRef.current
          // Echo of our own rotation: skip the toast (we already toasted
          // locally) but still sync + invalidate so the vault matches.
          const isEcho = isLocalKeyRotationEcho(fieldName, newVersion)
          try {
            await keyVault.syncFieldKeys(userId)
            // Invalidate all field queries: any entry's field could be affected
            queryClient.invalidateQueries({ queryKey: queryKeys.field.all })
            if (!isEcho) {
              toast.success(t('realtime.keyRotationApplied', { field: fieldName, version: newVersion }))
            }
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
