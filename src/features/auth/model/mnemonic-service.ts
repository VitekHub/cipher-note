import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { fetchFreshEnvelope } from '@/shared/api/supabase-keys'
import {
  saveRecoveryData,
  fetchRecoveryData,
  fetchRecoveryDataPreAuth,
  recoverAccount,
} from '@/shared/api/supabase-recovery'
import { createRecoveryData, unwrapMasterKeyWithRecovery } from '@/shared/crypto/keys/mnemonic'
import { unwrapMasterKeyWithPassword, wrapMasterKeyWithPassword } from '@/shared/crypto/keys/master-key'
import { derivePasswordKey, deriveAuthCredentials } from '@/shared/crypto/keys/split-kdf'
import { hexDecode, hexEncode, generateSalt, zeroFill } from '@/shared/crypto/core/crypto-utils'
import { keyVault } from '@/shared/crypto/vault/key-vault'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { DecryptionError } from '@/shared/crypto/core/errors'

/**
 * Thrown when account recovery succeeded (password changed on server)
 * but automatic login or vault initialization failed.
 * The user should log in manually with their new password.
 */
export class RecoveryLoginError extends Error {
  constructor(cause?: Error) {
    super('Recovery succeeded but automatic login failed', { cause })
    this.name = 'RecoveryLoginError'
  }
}

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

  const passwordKey = await derivePasswordKey(password, envelope.kdfSalt)
  try {
    const masterKey = await unwrapMasterKeyWithPassword(passwordKey, envelope)

    try {
      const { mnemonic, recoveryData } = await createRecoveryData(masterKey)

      await saveRecoveryData(user.id, {
        recoveryKeySalt: hexEncode(recoveryData.recoveryKeySalt),
        recoveryWrappedMasterKey: hexEncode(recoveryData.recoveryWrappedMasterKey),
        recoveryKeyIV: hexEncode(recoveryData.recoveryKeyIV),
        recoveryAuthHash: recoveryData.recoveryAuthHash,
      })

      return mnemonic
    } finally {
      zeroFill(masterKey)
    }
  } finally {
    zeroFill(passwordKey)
  }
}

/**
 * Stateful recovery flow: validate mnemonic → set new password.
 *
 * Groups the multi-step recovery flow and its shared state (master key,
 * recoveryAuthHash) into a single class. The master key is held in instance
 * state (never in React state) to avoid exposure in devtools.
 * Zero-filled immediately after use.
 */
class RecoveryFlow {
  private state: {
    username: string
    masterKey: Uint8Array<ArrayBuffer>
    recoveryAuthHash: string
  } | null = null

  /**
   * Step 1: validate the mnemonic and recover the master key.
   *
   * @throws DecryptionError if the mnemonic is wrong
   * @throws ApiError(NOT_FOUND) if the account has no recovery data
   */
  async validateMnemonic(username: string, mnemonic: string): Promise<void> {
    const recoveryData = await fetchRecoveryDataPreAuth(username)

    const { masterKey, recoveryAuthHash } = await unwrapMasterKeyWithRecovery(
      hexDecode(recoveryData.recoveryWrappedMasterKey),
      mnemonic,
      { iv: hexDecode(recoveryData.recoveryKeyIV), salt: hexDecode(recoveryData.recoveryKeySalt) },
    )

    this.state = { username, masterKey, recoveryAuthHash }
  }

  /**
   * Step 2: set a new password after mnemonic validation.
   * Re-wraps the master key, calls the recoverAccount RPC, then logs in and unlocks the vault.
   * @throws Error if validateMnemonic was not called first
   */
  async setNewPassword(newPassword: string): Promise<void> {
    if (!this.state) {
      throw new Error('Must call validateMnemonic before setNewPassword')
    }

    const { username, masterKey, recoveryAuthHash } = this.state
    const kdfSalt = generateSalt()
    const { authHash, passwordKey } = await deriveAuthCredentials(newPassword, kdfSalt)

    try {
      const { wrappedMasterKey: newWrappedMasterKey, masterKeyIV: newMasterKeyIV } = await wrapMasterKeyWithPassword(
        masterKey,
        passwordKey,
      )

      try {
        const userId = await recoverAccount(username, {
          recoveryAuthHash,
          newAuthHash: authHash,
          newKdfSalt: hexEncode(kdfSalt),
          newWrappedMasterKey: hexEncode(newWrappedMasterKey),
          newMasterKeyIV: hexEncode(newMasterKeyIV),
        })

        // recoverAccount succeeded, password is changed on the server.
        // If login or vault init fails below, the user can still log in manually.
        try {
          const authResult = await authAdapter.login(username, authHash)
          useAuthStore.getState().setAuth(authResult.user, authResult.session)

          await keyVault.initVault(userId, passwordKey)
        } catch (loginOrVaultError) {
          throw new RecoveryLoginError(loginOrVaultError instanceof Error ? loginOrVaultError : undefined)
        }
      } finally {
        zeroFill(newWrappedMasterKey)
        zeroFill(newMasterKeyIV)
      }
    } finally {
      zeroFill(passwordKey)
      this.clear()
    }
  }

  /**
   * Zero-fill the master key and clear recovery state.
   * Call on component unmount or explicit cancel as a safety net.
   */
  clear(): void {
    if (this.state) {
      zeroFill(this.state.masterKey)
      this.state = null
    }
  }
}

export const recoveryFlow = new RecoveryFlow()

/**
 * Verify that a mnemonic can unwrap the stored recovery data.
 *
 * @returns true if the mnemonic is correct, false if it produces a DecryptionError
 */
export async function verifyMnemonic(mnemonic: string): Promise<boolean> {
  const { user } = useAuthStore.getState()
  if (!user) throw new Error('No authenticated user')

  const recoveryData = await fetchRecoveryData(user.id)
  if (!recoveryData) {
    throw new Error('No recovery data found for user')
  }

  let masterKey: Uint8Array<ArrayBuffer> | null = null
  try {
    ;({ masterKey } = await unwrapMasterKeyWithRecovery(hexDecode(recoveryData.recoveryWrappedMasterKey), mnemonic, {
      iv: hexDecode(recoveryData.recoveryKeyIV),
      salt: hexDecode(recoveryData.recoveryKeySalt),
    }))
    return true
  } catch (error) {
    if (error instanceof DecryptionError) {
      return false
    }
    throw error
  } finally {
    if (masterKey) zeroFill(masterKey)
  }
}
