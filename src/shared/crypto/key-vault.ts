import { useCryptoStore } from '@/shared/crypto/crypto-store'

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

  async storeFieldKeys(kek: CryptoKey, fieldKeys: Map<string, CryptoKey>): Promise<void> {
    this.storeKey('kek', kek)

    const fieldKeyNames: Array<string> = []
    for (const [name, key] of fieldKeys) {
      this.storeKey(name, key)
      fieldKeyNames.push(name)
    }
    useCryptoStore.getState().setKeys(fieldKeyNames)
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
}

export const keyVault = new KeyVault()
