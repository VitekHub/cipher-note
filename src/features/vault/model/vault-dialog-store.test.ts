import { describe, it, expect } from 'vitest'
import { useVaultDialogStore } from './vault-dialog-store'

describe('vault-dialog-store', () => {
  it('initializes with dialog closed', () => {
    expect(useVaultDialogStore.getState().isOpen).toBe(false)
  })

  it('open sets isOpen to true', () => {
    useVaultDialogStore.getState().open()
    expect(useVaultDialogStore.getState().isOpen).toBe(true)
  })

  it('close sets isOpen to false', () => {
    useVaultDialogStore.getState().open()
    useVaultDialogStore.getState().close()
    expect(useVaultDialogStore.getState().isOpen).toBe(false)
  })
})
