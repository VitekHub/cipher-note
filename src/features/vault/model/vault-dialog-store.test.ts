import { describe, it, expect } from 'vitest'
import { useVaultDialogStore } from './vault-dialog-store'

describe('vault-dialog-store', () => {
  it('initializes with dialog closed', () => {
    expect(useVaultDialogStore.getState().isUnlockDialogOpen).toBe(false)
  })

  it('openUnlockDialog sets isUnlockDialogOpen to true', () => {
    useVaultDialogStore.getState().openUnlockDialog()
    expect(useVaultDialogStore.getState().isUnlockDialogOpen).toBe(true)
  })

  it('closeUnlockDialog sets isUnlockDialogOpen to false', () => {
    useVaultDialogStore.getState().openUnlockDialog()
    useVaultDialogStore.getState().closeUnlockDialog()
    expect(useVaultDialogStore.getState().isUnlockDialogOpen).toBe(false)
  })
})
