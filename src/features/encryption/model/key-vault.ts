import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { deriveLoginKeys } from '@/features/encryption/model/login'
import { deriveLoginCredentials } from '@/shared/crypto/split-kdf'
import { getMasterKeyEnvelope, getFieldKeys } from '@/shared/api/supabase-keys'
import { hexDecode, zeroFill } from '@/shared/crypto/crypto-utils'
import { importKey } from '@/shared/crypto/aes-gcm'
import { DecryptionError } from '@/shared/crypto/errors'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'
import { terminateWorker } from '@/shared/crypto/argon2id'

/**
 * Module-scoped crypto key vault.
 *
 * Stores CryptoKey objects with extractable: false, so exportKey() fails.
 * Keys are identified by well-known IDs: 'kek', 'note', 'website', 'email'.
 */
class KeyVault {
  private vault = new Map<string, CryptoKey>()

  storeKey(id: string, key: CryptoKey): void {
    this.vault.set(id, key)
  }

  getKey(id: string): CryptoKey | undefined {
    return this.vault.get(id)
  }

  hasKey(id: string): boolean {
    return this.vault.has(id)
  }

  zeroKeys(): void {
    this.vault.clear()
  }

  /** Zero keys, set isVaultLocked, purge query cache. Preserves cached envelope. */
  lockVault(): void {
    this.zeroKeys()
    useCryptoStore.getState().lockVault()
  }

  /** Zero all state including cached envelope. Used on logout. */
  clearVault(): void {
    this.zeroKeys()
    useCryptoStore.getState().clearVault()
    terminateWorker()
  }

  /**
   * Unlock the vault: re-derive keys from password and populate the crypto store.
   * Uses cached envelope when available (skips network calls).
   * On decryption failure with cached envelope, clears cache and retries from server.
   */
  async unlockVault(password: string): Promise<void> {
    const user = useAuthStore.getState().user
    if (!user) {
      throw new Error('Cannot unlock vault: no authenticated user')
    }

    let staleCache = false
    const cachedEnvelope = useCryptoStore.getState().cachedEnvelope
    if (cachedEnvelope) {
      try {
        await this.unlockWithEnvelope(password, cachedEnvelope)
      } catch (error) {
        if (error instanceof DecryptionError) {
          // Cached envelope may be stale (password changed in another session).
          // Clear the stale cache and retry the full network + derivation path.
          useCryptoStore.getState().clearVault()
          staleCache = true
        } else {
          throw error
        }
      }
    }

    if (!cachedEnvelope || staleCache) {
      // Sequential: both calls require an active auth session;
      // parallel requests can race on session initialization
      const masterKeyEnvelope = await getMasterKeyEnvelope(user.id)
      const serverFieldKeys = await getFieldKeys(user.id)
      const freshEnvelope = { ...masterKeyEnvelope, fieldKeys: serverFieldKeys }
      useCryptoStore.getState().setCachedEnvelope(freshEnvelope)
      await this.unlockWithEnvelope(password, freshEnvelope)
    }
  }

  private async unlockWithEnvelope(password: string, envelope: CachedVaultEnvelope): Promise<void> {
    const { passwordKey } = await deriveLoginCredentials(
      password,
      hexDecode(envelope.authSalt),
      hexDecode(envelope.keySalt),
    )

    const { masterKey, kek, fieldKeys } = await deriveLoginKeys({
      passwordKey,
      wrappedMasterKey: hexDecode(envelope.wrappedMasterKey),
      masterKeyIV: hexDecode(envelope.masterKeyIV),
      serverFieldKeys: envelope.fieldKeys,
    })

    // Store KEK and field keys in the vault (non-extractable CryptoKeys)
    this.storeKey('kek', kek)
    for (const [name, key] of fieldKeys) {
      this.storeKey(name, await importKey(key))
    }
    useCryptoStore.getState().setKeys(['note', 'website', 'email'])
    zeroFill(masterKey)
  }
}

export const keyVault = new KeyVault()
