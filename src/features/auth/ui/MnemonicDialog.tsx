import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Download, ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Label } from '@/shared/ui/label'
import { toast } from 'sonner'

interface MnemonicDialogProps {
  open: boolean
  mnemonic: string
  onContinue: () => void
}

function MnemonicDialog({ open, mnemonic, onContinue }: MnemonicDialogProps) {
  const { t } = useTranslation('auth')
  const [acknowledged, setAcknowledged] = useState(false)

  const words = mnemonic ? mnemonic.trim().split(/\s+/) : []

  function handleOpenChange(nextOpen: boolean) {
    // Prevent dismissal — user must acknowledge the mnemonic before continuing
    if (!nextOpen) return
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
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleContinue() {
    setAcknowledged(false)
    onContinue()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('mnemonic.title')}</DialogTitle>
          <DialogDescription>{t('mnemonic.description')}</DialogDescription>
        </DialogHeader>

        <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-md border p-3">
          <ShieldAlert className="text-destructive mt-0.5 size-4 shrink-0" />
          <p className="text-destructive text-sm">{t('mnemonic.warning')}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {words.map((word, index) => (
            <div key={index} className="bg-muted rounded-md px-3 py-2 text-center font-mono text-sm">
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

        <div className="flex items-start gap-2">
          <Checkbox
            id="mnemonic-acknowledge"
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
          />
          <Label htmlFor="mnemonic-acknowledge" className="text-sm font-normal">
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
