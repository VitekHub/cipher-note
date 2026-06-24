import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { useChangePasswordDialogStore } from '@/shared/auth/change-password-dialog-store'
import { SecuritySection } from './SecuritySection'

describe('SecuritySection', () => {
  beforeEach(() => {
    useChangePasswordDialogStore.setState({ isChangePasswordDialogOpen: false })
  })

  it('renders section title and description', () => {
    render(<SecuritySection />)
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Manage your password and security settings.')).toBeInTheDocument()
  })

  it('renders three action items', () => {
    render(<SecuritySection />)
    expect(screen.getByText('Change password')).toBeInTheDocument()
    expect(screen.getByText('View seed phrase')).toBeInTheDocument()
    expect(screen.getByText('Key versions')).toBeInTheDocument()
  })

  it('renders two separator dividers between action items', () => {
    render(<SecuritySection />)
    const separators = screen.getAllByRole('separator')
    expect(separators).toHaveLength(2)
  })

  it('opens change password dialog when clicking "Change password"', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const changePasswordButton = screen.getByRole('button', { name: /Change password/i })
    await user.click(changePasswordButton)

    expect(useChangePasswordDialogStore.getState().isChangePasswordDialogOpen).toBe(true)
  })

  it('opens change password dialog with Space key', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const changePasswordButton = screen.getByRole('button', { name: /Change password/i })
    changePasswordButton.focus()
    await user.keyboard(' ')

    expect(useChangePasswordDialogStore.getState().isChangePasswordDialogOpen).toBe(true)
  })
})
