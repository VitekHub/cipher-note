import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { MnemonicInput } from '@/features/auth/ui/MnemonicInput'
import { useVerifyMnemonicDialogStore } from '@/shared/auth/auth-dialogs-store'
import { verifyMnemonic } from '@/features/auth/model/mnemonic-service'
import { getRecoveryErrorMessage } from '@/features/auth/model/recovery-error-messages'

const EMPTY_WORDS = () => Array.from({ length: 12 }, () => '')

function VerifyMnemonicDialog() {
  const { t } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const isOpen = useVerifyMnemonicDialogStore((s) => s.isOpen)
  const closeDialog = useVerifyMnemonicDialogStore((s) => s.close)
  const [words, setWords] = useState<string[]>(EMPTY_WORDS)
  const [isValid, setIsValid] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    closeDialog()
    setWords(EMPTY_WORDS())
    setIsValid(false)
    setIsSubmitting(false)
    setError(null)
  }

  const handleChange = useCallback((newWords: string[]) => {
    setWords(newWords)
    setError(null)
  }, [])

  const handleValidityChange = useCallback((valid: boolean) => {
    setIsValid(valid)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await verifyMnemonic(words.join(' '))
      if (result) {
        toast.success(t('verifyMnemonic.success'))
        handleClose()
      } else {
        setError(t('verifyMnemonic.failure'))
      }
    } catch (err) {
      setError(getRecoveryErrorMessage(err, t))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      preventClose={isSubmitting}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('verifyMnemonic.title')}</DialogTitle>
          <DialogDescription>{t('verifyMnemonic.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <MnemonicInput
            value={words}
            onChange={handleChange}
            onValidityChange={handleValidityChange}
            error={error ?? undefined}
            disabled={isSubmitting}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? t('verifyMnemonic.submitting') : t('verifyMnemonic.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { VerifyMnemonicDialog }
