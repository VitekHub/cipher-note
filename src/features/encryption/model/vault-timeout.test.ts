import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'

import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { DEFAULT_VAULT_TIMEOUT_MS } from './vault-timeout'

vi.mock('@/shared/crypto/key-vault', () => ({
  keyVault: {
    lockVault: vi.fn<() => void>(),
  },
}))

import { keyVault } from '@/shared/crypto/key-vault'
import { useVaultTimeout } from './vault-timeout'
import { renderHook } from '@/test/utils'

describe('useVaultTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useCryptoStore.setState({ isVaultLocked: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    useCryptoStore.setState({ isVaultLocked: true })
  })

  it('does not start timer when vault is locked', () => {
    renderHook(() => useVaultTimeout())

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS + 1000)

    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('starts timer when vault is unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    renderHook(() => useVaultTimeout())

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS)

    expect(keyVault.lockVault).toHaveBeenCalledTimes(1)
  })

  it('resets timer on mousemove', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    renderHook(() => useVaultTimeout())

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS - 1000)
    document.dispatchEvent(new Event('mousemove'))

    vi.advanceTimersByTime(500)
    expect(keyVault.lockVault).not.toHaveBeenCalled()

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS)
    expect(keyVault.lockVault).toHaveBeenCalledTimes(1)
  })

  it('resets timer on keydown', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    renderHook(() => useVaultTimeout())

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS - 500)
    document.dispatchEvent(new Event('keydown'))

    vi.advanceTimersByTime(500)
    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('resets timer on mousedown', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    renderHook(() => useVaultTimeout())

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS - 500)
    document.dispatchEvent(new Event('mousedown'))

    vi.advanceTimersByTime(500)
    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('resets timer on touchstart', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    renderHook(() => useVaultTimeout())

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS - 500)
    document.dispatchEvent(new Event('touchstart'))

    vi.advanceTimersByTime(500)
    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('resets timer on scroll', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    renderHook(() => useVaultTimeout())

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS - 500)
    document.dispatchEvent(new Event('scroll'))

    vi.advanceTimersByTime(500)
    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('stops timer when vault becomes locked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    renderHook(() => useVaultTimeout())

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS - 1000)

    act(() => {
      useCryptoStore.setState({ isVaultLocked: true })
    })

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS)

    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('cleans up event listeners on unmount', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    const { unmount } = renderHook(() => useVaultTimeout())

    unmount()

    vi.advanceTimersByTime(DEFAULT_VAULT_TIMEOUT_MS)

    expect(keyVault.lockVault).not.toHaveBeenCalled()
  })

  it('supports custom timeout', () => {
    const customTimeout = 5000
    useCryptoStore.setState({ isVaultLocked: false })
    renderHook(() => useVaultTimeout(customTimeout))

    vi.advanceTimersByTime(customTimeout)

    expect(keyVault.lockVault).toHaveBeenCalledTimes(1)
  })
})
