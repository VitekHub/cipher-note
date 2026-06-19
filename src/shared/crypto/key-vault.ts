import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { fetchMasterKeyEnvelope, fetchFieldKeys } from '@/shared/api/supabase-keys'
import { hexDecode, zeroFill } from '@/shared/crypto/crypto-utils'
import { decrypt, importKey } from '@/shared/crypto/aes-gcm'
import { unwrapFieldKeys } from '@/shared/crypto/key-hierarchy'
import { deriveKEK } from '@/shared/crypto/hkdf'
import { MASTER_KEY_PASSWORD_AAD } from '@/shared/types/crypto.types'
import { derivePasswordKey } from '@/shared/crypto/argon2id'
import { DecryptionError } from '@/shared/crypto/errors'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'

/**
 * Module-scoped crypto key vault.
 *
 * Stores CryptoKey objects with extractable: false, so exportKey() fails.
 * Keys are identified by well-known IDs: 'kek', 'note', 'website', 'email', 'title'.
 */
class KeyVault {
  private vault = new Map<string, CryptoKey>()

  storeKey(id: string, key: CryptoKey): void {
    this.vault.set(id, key)
  }

  storeFieldKeys(fieldKeys: Map<string, CryptoKey>): void {
    const fieldKeyNames: Array<string> = []
    for (const [name, key] of fieldKeys) {
      this.storeKey(name, key)
      fieldKeyNames.push(name)
    }
    useCryptoStore.getState().markKeysLoaded(fieldKeyNames)
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
  }

  /**
   * Fetches all field keys from the server, unwraps them with the existing
   * KEK, and stores the new CryptoKeys in the vault.
   *
   * Throws if the vault is locked (no KEK), on network errors, or on
   * decryption failures (stale KEK from a password change on another device).
   */
  async syncFieldKeys(userId: string): Promise<void> {
    try {
      const kek = this.getKey('kek')
      if (!kek) {
        throw new Error('Cannot refresh field keys: vault is locked (no KEK)')
      }

      const serverFieldKeys = await fetchFieldKeys(userId)
      const unwrappedKeys = await unwrapFieldKeys(serverFieldKeys, kek)
      this.storeFieldKeys(unwrappedKeys)

      // Update the cached envelope with the fresh field key data
      const envelope = useCryptoStore.getState().cachedEnvelope
      if (envelope) {
        useCryptoStore.getState().setCachedEnvelope({
          ...envelope,
          fieldKeys: serverFieldKeys,
        })
      }
    } catch (error) {
      // Only clear vault on decryption failures (stale KEK).
      // Network errors should not force a vault lock.
      if (error instanceof DecryptionError) {
        this.clearVault()
      }
      throw error
    }
  }

  /**
   * Unlock the vault by populating the KeyVault with non-extractable CryptoKey objects.
   *
   * Uses the cached envelope to skip network calls. If decryption fails (e.g., stale
   * cache from a password change in another session), fetches fresh key material from
   * the server.
   */
  async unlockVault(userId: string, password: string): Promise<void> {
    let staleCache = false
    const cachedEnvelope = useCryptoStore.getState().cachedEnvelope
    if (cachedEnvelope) {
      try {
        await this.populateKeyVault(password, cachedEnvelope)
      } catch (error) {
        if (error instanceof DecryptionError) {
          // Cached envelope may be stale (password changed in another session).
          // Clear the stale cache and retry the full network + derivation path.
          this.clearVault()
          staleCache = true
        } else {
          throw error
        }
      }
    }

    if (!cachedEnvelope || staleCache) {
      const freshEnvelope = await this.fetchFreshEnvelope(userId)
      useCryptoStore.getState().setCachedEnvelope(freshEnvelope)
      await this.populateKeyVault(password, freshEnvelope)
    }
  }

  /**
   * Derives the KEK from a password and a master key envelope, unwraps field keys,
   * and stores them in the KeyVault as non-extractable CryptoKeys - making the vault operational.
   */
  private async populateKeyVault(password: string, envelope: CachedVaultEnvelope) {
    // Store KEK and field keys in the vault (non-extractable CryptoKeys)
    const kek = await this.deriveKekFromEnvelope(password, envelope)
    this.storeKey('kek', kek)
    const unwrappedFieldKeys = await unwrapFieldKeys(envelope.fieldKeys, kek)
    this.storeFieldKeys(unwrappedFieldKeys)
  }

  private async fetchFreshEnvelope(userId: string): Promise<CachedVaultEnvelope> {
    // Sequential: both calls require an active auth session;
    // parallel requests can race on session initialization
    const masterKeyEnvelope = await fetchMasterKeyEnvelope(userId)
    const serverFieldKeys = await fetchFieldKeys(userId)
    const freshEnvelope = { ...masterKeyEnvelope, fieldKeys: serverFieldKeys }
    return freshEnvelope
  }

  private async deriveKekFromEnvelope(password: string, envelope: CachedVaultEnvelope): Promise<CryptoKey> {
    // Derive password key
    const passwordKey = await derivePasswordKey(password, hexDecode(envelope.keySalt))
    const cryptoPasswordKey = await importKey(passwordKey)
    zeroFill(passwordKey)

    // Unwrap master key → derive KEK
    const wrappedMasterKey = hexDecode(envelope.wrappedMasterKey)
    const masterKey = await decrypt(wrappedMasterKey, cryptoPasswordKey, {
      iv: hexDecode(envelope.masterKeyIV),
      aad: MASTER_KEY_PASSWORD_AAD,
    })
    const kekBytes = await deriveKEK(masterKey)
    const kek = await importKey(kekBytes)
    zeroFill(kekBytes)
    zeroFill(masterKey)
    return kek
  }
}

export const keyVault = new KeyVault()
