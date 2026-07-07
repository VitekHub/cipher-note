import { describe, it, expect, beforeEach } from 'vitest'

import { useVaultSettingsStore, DEFAULT_VAULT_TIMEOUT_MS } from './vault-settings-store'

describe('vault-settings-store', () => {
  beforeEach(() => {
    useVaultSettingsStore.setState({
      vaultTimeoutMs: DEFAULT_VAULT_TIMEOUT_MS,
      lockOnTabHidden: false,
    })
  })

  it('initializes with default values', () => {
    const state = useVaultSettingsStore.getState()
    expect(state.vaultTimeoutMs).toBe(DEFAULT_VAULT_TIMEOUT_MS)
    expect(state.lockOnTabHidden).toBe(false)
  })

  it('setVaultTimeoutMs updates vaultTimeoutMs', () => {
    useVaultSettingsStore.getState().setVaultTimeoutMs(5 * 60 * 1000)
    expect(useVaultSettingsStore.getState().vaultTimeoutMs).toBe(5 * 60 * 1000)

    useVaultSettingsStore.getState().setVaultTimeoutMs(60 * 60 * 1000)
    expect(useVaultSettingsStore.getState().vaultTimeoutMs).toBe(60 * 60 * 1000)
  })

  it('setLockOnTabHidden updates lockOnTabHidden', () => {
    useVaultSettingsStore.getState().setLockOnTabHidden(true)
    expect(useVaultSettingsStore.getState().lockOnTabHidden).toBe(true)

    useVaultSettingsStore.getState().setLockOnTabHidden(false)
    expect(useVaultSettingsStore.getState().lockOnTabHidden).toBe(false)
  })
})
