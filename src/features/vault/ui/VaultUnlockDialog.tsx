import { useTranslation } from 'react-i18next'

import { useAuth } from '@/shared/auth/auth-context'
import { keyVault } from '@/shared/crypto/vault/key-vault'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'
import { getVaultErrorMessage } from '@/features/vault/model/vault-error-messages'
import { PasswordConfirmDialog } from '@/shared/ui/PasswordConfirmDialog'

function VaultUnlockDialog() {
  const { t } = useTranslation('vault')
  const { user } = useAuth()
  const isOpen = useVaultDialogStore((s) => s.isOpen)
  const close = useVaultDialogStore((s) => s.close)

  async function unlockVault(password: string) {
    if (!user) throw new Error('No authenticated user')
    await keyVault.unlockVault(user.id, password)
    close()
  }

  function mapError(error: unknown) {
    return getVaultErrorMessage(error, t)
  }

  return (
    <PasswordConfirmDialog
      isOpen={isOpen}
      onClose={close}
      onConfirm={unlockVault}
      mapError={mapError}
      title={t('vaultUnlockDialog.title')}
      description={t('vaultUnlockDialog.description')}
      submitLabel={t('vaultUnlockDialog.submit')}
      isSubmittingLabel={t('vaultUnlockDialog.submitting')}
      submitTestId="vault-unlock-submit"
    />
  )
}

export { VaultUnlockDialog }
