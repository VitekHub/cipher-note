import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

// Mock the auth service module
vi.mock('@/features/auth/model/auth-service', () => ({
  changeUserPassword: vi.fn(),
}))

import { ChangePasswordDialog } from './ChangePasswordDialog'
import { changeUserPassword } from '@/features/auth/model/auth-service'
import { useChangePasswordDialogStore } from '@/shared/auth/auth-dialogs-store'

const mockChangeUserPassword = vi.mocked(changeUserPassword)

describe('ChangePasswordDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChangePasswordDialogStore.setState({ isOpen: true })
  })

  it('renders the dialog with all form fields when open', () => {
    render(<ChangePasswordDialog />)

    expect(screen.getByLabelText('Current password')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument()
  })

  it('does not render form fields when closed', () => {
    useChangePasswordDialogStore.setState({ isOpen: false })
    render(<ChangePasswordDialog />)

    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
  })

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordDialog />)

    const submitButton = screen.getByRole('button', { name: 'Change password' })
    await user.click(submitButton)

    // Should show validation errors for required fields
    await vi.waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    })
  })

  it('calls changeUserPassword on valid form submission', async () => {
    const user = userEvent.setup()
    mockChangeUserPassword.mockResolvedValue(undefined)

    render(<ChangePasswordDialog />)

    await user.type(screen.getByLabelText('Current password'), 'oldPassword123')
    await user.type(screen.getByLabelText('New password'), 'newPassword456')
    await user.type(screen.getByLabelText('Confirm new password'), 'newPassword456')

    const submitButton = screen.getByRole('button', { name: 'Change password' })
    await user.click(submitButton)

    await vi.waitFor(() => {
      expect(mockChangeUserPassword).toHaveBeenCalledWith('oldPassword123', 'newPassword456')
    })
  })

  it('closes the dialog after successful submission', async () => {
    const user = userEvent.setup()
    mockChangeUserPassword.mockResolvedValue(undefined)

    render(<ChangePasswordDialog />)

    await user.type(screen.getByLabelText('Current password'), 'oldPassword123')
    await user.type(screen.getByLabelText('New password'), 'newPassword456')
    await user.type(screen.getByLabelText('Confirm new password'), 'newPassword456')

    const submitButton = screen.getByRole('button', { name: 'Change password' })
    await user.click(submitButton)

    await vi.waitFor(() => {
      expect(useChangePasswordDialogStore.getState().isOpen).toBe(false)
    })
  })

  it('shows error toast when changeUserPassword fails', async () => {
    const user = userEvent.setup()
    mockChangeUserPassword.mockRejectedValue(new Error('Test error'))

    render(<ChangePasswordDialog />)

    await user.type(screen.getByLabelText('Current password'), 'oldPassword123')
    await user.type(screen.getByLabelText('New password'), 'newPassword456')
    await user.type(screen.getByLabelText('Confirm new password'), 'newPassword456')

    const submitButton = screen.getByRole('button', { name: 'Change password' })
    await user.click(submitButton)

    await vi.waitFor(() => {
      expect(mockChangeUserPassword).toHaveBeenCalled()
    })
  })

  it('hides close button and blocks Escape during submission', async () => {
    let resolveChange: () => void = () => {}
    mockChangeUserPassword.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveChange = resolve
      }),
    )
    const user = userEvent.setup()
    render(<ChangePasswordDialog />)

    await user.type(screen.getByLabelText('Current password'), 'oldPassword123')
    await user.type(screen.getByLabelText('New password'), 'newPassword456')
    await user.type(screen.getByLabelText('Confirm new password'), 'newPassword456')

    const submitButton = screen.getByRole('button', { name: 'Change password' })
    await user.click(submitButton)

    // Close button should be hidden during submission
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()

    // Escape should not close the dialog
    await user.keyboard('{Escape}')
    expect(useChangePasswordDialogStore.getState().isOpen).toBe(true)

    // Clean up: resolve the promise
    resolveChange()
  })
})
