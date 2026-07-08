import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useVaultSettingsStore } from '@/shared/stores/vault-settings-store'

const toastWarning = vi.hoisted(() => vi.fn<(msg: string, options?: unknown) => string | number>())

vi.mock('sonner', () => ({
  toast: { warning: toastWarning },
}))

vi.mock('@/shared/crypto/vault/key-vault', () => ({
  keyVault: {
    lockVault: vi.fn<() => void>(),
  },
}))

import { keyVault } from '@/shared/crypto/vault/key-vault'
import { useVaultVisibilityLock } from './use-vault-visibility-lock'
import { renderHook } from '@/test/utils'

function setVisibilityState(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

describe('useVaultVisibilityLock', () => {
  beforeEach(() => {
    useCryptoStore.setState({ isVaultLocked: true })
    useVaultSettingsStore.setState({ lockOnTabHidden: false })
    setVisibilityState('visible')
    vi.clearAllMocks()
  })

  afterEach(() => {
    useCryptoStore.setState({ isVaultLocked: true })
    useVaultSettingsStore.setState({ lockOnTabHidden: false })
    setVisibilityState('visible')
  })

  it('does nothing when disabled', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    renderHook(() => useVaultVisibilityLock())

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('locks the vault when document becomes hidden and vault is unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    useVaultSettingsStore.setState({ lockOnTabHidden: true })
    renderHook(() => useVaultVisibilityLock())

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(keyVault.lockVault).toHaveBeenCalledTimes(1)
    expect(toastWarning).toHaveBeenCalledTimes(1)
    expect(toastWarning.mock.calls[0][0]).toBe('Vault locked due to tab switch.')
  })

  it('does not lock when the vault is already locked', () => {
    useCryptoStore.setState({ isVaultLocked: true })
    useVaultSettingsStore.setState({ lockOnTabHidden: true })
    renderHook(() => useVaultVisibilityLock())

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('does not lock when document becomes visible', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    useVaultSettingsStore.setState({ lockOnTabHidden: true })
    renderHook(() => useVaultVisibilityLock())

    setVisibilityState('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('removes the listener on unmount', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    useVaultSettingsStore.setState({ lockOnTabHidden: true })
    const { unmount } = renderHook(() => useVaultVisibilityLock())

    unmount()

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })
})
