import { describe, it, expect, beforeEach } from 'vitest'
import { useRegenerateMnemonicDialogStore } from './regenerate-mnemonic-dialog-store'

describe('regenerate-mnemonic-dialog-store', () => {
  beforeEach(() => {
    useRegenerateMnemonicDialogStore.setState({ isRegenerateMnemonicDialogOpen: false })
  })

  it('initializes with dialog closed', () => {
    expect(useRegenerateMnemonicDialogStore.getState().isRegenerateMnemonicDialogOpen).toBe(false)
  })

  it('openRegenerateMnemonicDialog sets isRegenerateMnemonicDialogOpen to true', () => {
    useRegenerateMnemonicDialogStore.getState().openRegenerateMnemonicDialog()
    expect(useRegenerateMnemonicDialogStore.getState().isRegenerateMnemonicDialogOpen).toBe(true)
  })

  it('closeRegenerateMnemonicDialog sets isRegenerateMnemonicDialogOpen to false', () => {
    useRegenerateMnemonicDialogStore.getState().openRegenerateMnemonicDialog()
    useRegenerateMnemonicDialogStore.getState().closeRegenerateMnemonicDialog()
    expect(useRegenerateMnemonicDialogStore.getState().isRegenerateMnemonicDialogOpen).toBe(false)
  })
})
