import { describe, it, expect, beforeEach } from 'vitest'
import { useChangePasswordDialogStore } from './change-password-dialog-store'

describe('change-password-dialog-store', () => {
  beforeEach(() => {
    useChangePasswordDialogStore.setState({ isChangePasswordDialogOpen: false })
  })

  it('initializes with dialog closed', () => {
    expect(useChangePasswordDialogStore.getState().isChangePasswordDialogOpen).toBe(false)
  })

  it('openChangePasswordDialog sets isChangePasswordDialogOpen to true', () => {
    useChangePasswordDialogStore.getState().openChangePasswordDialog()
    expect(useChangePasswordDialogStore.getState().isChangePasswordDialogOpen).toBe(true)
  })

  it('closeChangePasswordDialog sets isChangePasswordDialogOpen to false', () => {
    useChangePasswordDialogStore.getState().openChangePasswordDialog()
    useChangePasswordDialogStore.getState().closeChangePasswordDialog()
    expect(useChangePasswordDialogStore.getState().isChangePasswordDialogOpen).toBe(false)
  })
})
