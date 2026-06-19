import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import { useDeleteEntry } from '@/features/fields/model/use-entry'
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
  const { t } = useTranslation('entries')
  const navigate = useNavigate()
  const deleteEntry = useDeleteEntry()
  const [open, setOpen] = useState(false)

  function handleDelete() {
    deleteEntry.mutate(entryId, {
      onSuccess: () => {
        setOpen(false)
        navigate({ to: '/dashboard' })
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />}
      >
        <Trash2 className="mr-2 size-4" />
        {t('delete')}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('common:actions.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DeleteEntryDialog }
