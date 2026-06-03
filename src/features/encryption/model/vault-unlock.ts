import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { keyVault } from '@/shared/crypto/key-vault'
import { DecryptionError } from '@/shared/crypto/errors'
import { populateKeyVault } from '@/shared/crypto/key-vault-service'

/**
 * Unlock the vault by deriving the KEK from the password and populating the
 * KeyVault with non-extractable CryptoKey objects.
 *
 * Uses the cached envelope when available to skip network calls. If decryption
 * fails with the cached envelope (e.g., stale cache from a password change in
 * another session), clears the cache and fetches fresh key material from the server.
 */
export async function unlockVault(userId: string, password: string): Promise<void> {
  let staleCache = false
  const cachedEnvelope = useCryptoStore.getState().cachedEnvelope
  if (cachedEnvelope) {
    try {
      // populate key vault from cached envelope
      await populateKeyVault(userId, password, cachedEnvelope)
    } catch (error) {
      if (error instanceof DecryptionError) {
        // Cached envelope may be stale (password changed in another session).
        // Clear the stale cache and retry the full network + derivation path.
        keyVault.clearVault()
        staleCache = true
      } else {
        throw error
      }
    }
  }

  if (!cachedEnvelope || staleCache) {
    // fetch fresh envelope and populate key vault from that envelope
    await populateKeyVault(userId, password)
  }
}
