import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { fetchFreshEnvelope } from '@/shared/api/supabase-keys'
import { saveRecoveryData } from '@/shared/api/supabase-recovery'
import { regenerateRecoveryData } from '@/shared/crypto/mnemonic'
import { hexEncode } from '@/shared/crypto/crypto-utils'

/**
 * Regenerate the user's seed phrase for account recovery.
 * Unwraps the master key with the password, re-wraps it with a new recovery KEK,
 * saves the new recovery data to the server, and returns the new mnemonic.
 * No rollback is needed — if the save fails, the old recovery data remains valid.
 */
export async function regenerateMnemonic(password: string): Promise<string> {
  const { user } = useAuthStore.getState()

  if (!user) throw new Error('No authenticated user')

  const envelope = useCryptoStore.getState().cachedEnvelope ?? (await fetchFreshEnvelope(user.id))

  const { mnemonic, recoveryData } = await regenerateRecoveryData(password, envelope)

  await saveRecoveryData(user.id, {
    recoverySalt: hexEncode(recoveryData.recoverySalt),
    wrappedMasterKey: hexEncode(recoveryData.wrappedMasterKey),
    recoveryIV: hexEncode(recoveryData.recoveryIV),
  })

  return mnemonic
}
