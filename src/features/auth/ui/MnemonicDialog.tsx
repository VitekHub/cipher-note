import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Download, ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Label } from '@/shared/ui/label'
import { cn } from '@/shared/lib/utils'
import { toast } from 'sonner'

interface MnemonicDialogProps {
  open: boolean
  mnemonic: string
  onContinue: () => void
}

function MnemonicDialog({ open, mnemonic, onContinue }: MnemonicDialogProps) {
  const { t } = useTranslation('auth')
  const [acknowledged, setAcknowledged] = useState(false)
  const [dismissWarning, setDismissWarning] = useState(false)

  const words = mnemonic ? mnemonic.trim().split(/\s+/) : []

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDismissWarning(true)
      setTimeout(() => setDismissWarning(false), 1500)
      return
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(mnemonic)
      toast.success(t('mnemonic.copied'))
    } catch {
      toast.error(t('mnemonic.copyFailed'))
    }
  }

  function handleDownload() {
    const blob = new Blob([mnemonic], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('mnemonic.downloadFilename')}.txt`
    document.body.appendChild(a)
    try {
      a.click()
    } finally {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  function handleContinue() {
    setAcknowledged(false)
    onContinue()
  }

  const handleAcknowledge = useCallback((checked: boolean | 'indeterminate') => setAcknowledged(checked === true), [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('mnemonic.title')}</DialogTitle>
          <DialogDescription>{t('mnemonic.description')}</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-md border p-3 transition-shadow',
            dismissWarning && 'shadow-destructive/40 shadow-md',
          )}
        >
          <ShieldAlert className="text-destructive mt-0.5 size-4 shrink-0" />
          <p className="text-destructive text-sm">{t('mnemonic.warning')}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {words.map((word, index) => (
            <div key={index} className="bg-muted rounded-md px-3 py-2 text-center font-mono text-sm break-words">
              <span className="text-muted-foreground mr-1">{index + 1}.</span>
              {word}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} type="button">
            <Copy className="size-3.5" />
            {t('mnemonic.copy')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} type="button">
            <Download className="size-3.5" />
            {t('mnemonic.download')}
          </Button>
        </div>

        <div className="flex cursor-pointer items-start gap-2">
          <Checkbox id="mnemonic-acknowledge" checked={acknowledged} onCheckedChange={handleAcknowledge} />
          <Label htmlFor="mnemonic-acknowledge" className="cursor-pointer text-sm font-normal">
            {t('mnemonic.acknowledge')}
          </Label>
        </div>

        <DialogFooter>
          <Button onClick={handleContinue} disabled={!acknowledged} type="button">
            {t('register.continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { MnemonicDialog }
