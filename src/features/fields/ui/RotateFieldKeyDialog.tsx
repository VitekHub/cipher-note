import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { useRotateFieldKeyDialogStore } from '@/shared/auth/auth-dialogs-store'
import { useRequiredUserId } from '@/shared/auth/use-current-user'
import { queryKeys } from '@/shared/lib/query-keys'
import { FIELD_NAMES } from '@/shared/types/entities/field.types'
import type { FieldName } from '@/shared/types/entities/field.types'
import { rotateFieldKey } from '@/features/fields/model/key-rotation-service'
import { getKeyRotationErrorMessage } from '@/features/fields/model/key-rotation-error-messages'

// Static keys so i18next-parser can discover them.
const FIELD_LABEL_KEYS: Record<FieldName, string> = {
  title: 'keyRotation.field.title',
  note: 'keyRotation.field.note',
  website: 'keyRotation.field.website',
  email: 'keyRotation.field.email',
}

type Progress = { field: FieldName; done: number; total: number } | null

function RotateFieldKeyDialog() {
  const { t } = useTranslation('settings')
  const { t: tVault } = useTranslation('vault')
  const { t: tc } = useTranslation('common')
  const userId = useRequiredUserId()
  const queryClient = useQueryClient()

  const isOpen = useRotateFieldKeyDialogStore((s) => s.isOpen)
  const payload = useRotateFieldKeyDialogStore((s) => s.payload)
  const closeDialog = useRotateFieldKeyDialogStore((s) => s.close)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<Progress>(null)

  const isRotateAll = payload?.fieldName === null
  const fieldName = payload?.fieldName ?? null

  function handleClose() {
    if (isSubmitting) return
    closeDialog()
  }

  function toastError(error: unknown, name: FieldName) {
    toast.error(getKeyRotationErrorMessage(error, tVault), {
      description: t(FIELD_LABEL_KEYS[name]),
    })
  }

  async function handleConfirmSingle(name: FieldName) {
    setIsSubmitting(true)
    try {
      const newVersion = await rotateFieldKey(userId, name)
      queryClient.invalidateQueries({ queryKey: queryKeys.field.all })
      toast.success(t('keyRotation.success', { field: t(FIELD_LABEL_KEYS[name]), version: newVersion }))
      closeDialog()
    } catch (error) {
      toastError(error, name)
      closeDialog()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmAll() {
    setIsSubmitting(true)
    const total = FIELD_NAMES.length
    const failed: { name: FieldName; error: unknown }[] = []
    const succeeded: { name: FieldName; version: number }[] = []
    let done = 0
    for (const name of FIELD_NAMES) {
      setProgress({ field: name, done, total })
      try {
        const newVersion = await rotateFieldKey(userId, name)
        succeeded.push({ name, version: newVersion })
      } catch (error) {
        failed.push({ name, error })
      }
      done++
    }
    setProgress(null)
    queryClient.invalidateQueries({ queryKey: queryKeys.field.all })

    if (failed.length === 0) {
      toast.success(t('keyRotation.successAll'))
    } else {
      for (const { name, version } of succeeded) {
        toast.success(t('keyRotation.success', { field: t(FIELD_LABEL_KEYS[name]), version }))
      }
      for (const { name, error } of failed) {
        toastError(error, name)
      }
    }
    closeDialog()
    setIsSubmitting(false)
  }

  function handleConfirm() {
    if (!payload || isSubmitting) return
    if (fieldName) {
      void handleConfirmSingle(fieldName)
    } else {
      void handleConfirmAll()
    }
  }

  const confirmLabel = isRotateAll ? t('keyRotation.rotateAll') : t('keyRotation.rotate')

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isRotateAll
              ? t('keyRotation.confirmAll.title')
              : t('keyRotation.confirm.title', { field: fieldName ? t(FIELD_LABEL_KEYS[fieldName]) : '' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isRotateAll
              ? t('keyRotation.confirmAll.body')
              : t('keyRotation.confirm.body', { field: fieldName ? t(FIELD_LABEL_KEYS[fieldName]) : '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {progress && (
          <p className="text-muted-foreground text-sm">
            {t('keyRotation.progress', {
              field: t(FIELD_LABEL_KEYS[progress.field]),
              done: progress.done,
              total: progress.total,
            })}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>{tc('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? t('keyRotation.rotating') : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { RotateFieldKeyDialog }
