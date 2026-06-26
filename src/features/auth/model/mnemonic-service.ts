import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { fetchFreshEnvelope } from '@/shared/api/supabase-keys'
import { saveRecoveryData } from '@/shared/api/supabase-recovery'
import { createRecoveryData } from '@/shared/crypto/mnemonic'
import { unwrapMasterKeyWithPassword } from '@/shared/crypto/master-key'
import { hexEncode, zeroFill } from '@/shared/crypto/crypto-utils'

/**
 * Regenerate the user's seed phrase for account recovery.
 * Unwraps the master key with the password, re-wraps it with a new recovery KEK,
 * saves the new recovery data to the server, and returns the new mnemonic.
 * No rollback is needed — if the save fails, the old recovery data remains valid.
 */
export async function regenerateMnemonic(password: string): Promise<string> {
  const { user } = useAuthStore.getState()

  if (!user) throw new Error('No authenticated user')

  let envelope = useCryptoStore.getState().cachedEnvelope
  if (!envelope) {
    envelope = await fetchFreshEnvelope(user.id)
    useCryptoStore.getState().setCachedEnvelope(envelope)
  }

  const masterKey = await unwrapMasterKeyWithPassword(password, envelope)

  try {
    const { mnemonic, recoveryData } = await createRecoveryData(masterKey)

    await saveRecoveryData(user.id, {
      recoveryKeySalt: hexEncode(recoveryData.recoveryKeySalt),
      recoveryWrappedMasterKey: hexEncode(recoveryData.recoveryWrappedMasterKey),
      recoveryKeyIV: hexEncode(recoveryData.recoveryKeyIV),
    })

    return mnemonic
  } finally {
    zeroFill(masterKey)
  }
}
