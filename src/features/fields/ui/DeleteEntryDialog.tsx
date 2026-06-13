import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import { useDeleteEntry, useEntries } from '@/features/fields/model/use-entries'
import { Button } from '@/shared/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'

function DeleteEntryDialog({ entryId }: { entryId: string }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const deleteEntry = useDeleteEntry()
  const { data: entries } = useEntries()
  const [open, setOpen] = useState(false)

  function handleDelete() {
    deleteEntry.mutate(entryId, {
      onSuccess: () => {
        setOpen(false)
        if (entries && entries.length > 1) {
          const remaining = entries.filter((e) => e.id !== entryId)
          navigate({ to: '/dashboard/$entryId', params: { entryId: remaining[0].id } })
        } else {
          navigate({ to: '/dashboard' })
        }
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />}
      >
        <Trash2 className="mr-2 size-4" />
        {t('entries.delete')}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('entries.delete')}</AlertDialogTitle>
          <AlertDialogDescription>{t('entries.deleteConfirm')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('actions.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DeleteEntryDialog }
