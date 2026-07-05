import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PasswordConfirmDialog } from '@/shared/ui/PasswordConfirmDialog'
import { MnemonicDialog } from '@/features/auth/ui/MnemonicDialog'
import { useRegenerateMnemonicDialogStore } from '@/shared/auth/regenerate-mnemonic-dialog-store'
import { regenerateMnemonic } from '@/features/auth/model/mnemonic-service'
import { getRegenerateMnemonicErrorMessage } from '@/features/auth/model/recovery-error-messages'

function RegenerateMnemonicDialog() {
  const { t } = useTranslation('auth')
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const isPasswordDialogOpen = useRegenerateMnemonicDialogStore((s) => s.isRegenerateMnemonicDialogOpen)
  const closeDialog = useRegenerateMnemonicDialogStore((s) => s.closeRegenerateMnemonicDialog)
  const isMnemonicDialogOpen = mnemonic !== null

  async function handlePasswordConfirm(password: string) {
    const newMnemonic = await regenerateMnemonic(password)
    setMnemonic(newMnemonic)
  }

  function handleDialogClose() {
    setMnemonic(null)
    closeDialog()
  }

  function handleMnemonicConfirm() {
    toast.success(t('regenerateMnemonic.success'))
    handleDialogClose()
  }

  function mapError(error: unknown) {
    return getRegenerateMnemonicErrorMessage(error, t)
  }

  return (
    <>
      <PasswordConfirmDialog
        isOpen={isPasswordDialogOpen && !isMnemonicDialogOpen}
        onClose={handleDialogClose}
        onConfirm={handlePasswordConfirm}
        mapError={mapError}
        title={t('regenerateMnemonic.title')}
        description={t('regenerateMnemonic.description')}
        submitLabel={t('regenerateMnemonic.submit')}
        isSubmittingLabel={t('regenerateMnemonic.submitting')}
      />
      {mnemonic && (
        <MnemonicDialog open={isMnemonicDialogOpen} mnemonic={mnemonic} onContinue={handleMnemonicConfirm} />
      )}
    </>
  )
}

export { RegenerateMnemonicDialog }
