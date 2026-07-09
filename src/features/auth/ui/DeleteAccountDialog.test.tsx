import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { DeleteAccountDialog } from './DeleteAccountDialog'
import { useDeleteAccountDialogStore } from '@/shared/stores/dialogs-store'

vi.mock('@/features/auth/model/auth-service', () => ({
  deleteUserAccount: vi.fn(),
}))

vi.mock('@/features/auth/model/delete-account-error-messages', () => ({
  getDeleteAccountErrorMessage: vi.fn((_error: unknown, t: (key: string) => string) =>
    t('deleteAccount.errors.wrongPassword'),
  ),
}))

import { deleteUserAccount } from '@/features/auth/model/auth-service'

const mockDeleteUserAccount = vi.mocked(deleteUserAccount)

describe('DeleteAccountDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDeleteAccountDialogStore.getState().close()
  })

  it('renders password confirm dialog when open', () => {
    useDeleteAccountDialogStore.getState().open()
    render(<DeleteAccountDialog />)

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<DeleteAccountDialog />)

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })

  it('calls deleteUserAccount with entered password on submit', async () => {
    useDeleteAccountDialogStore.getState().open()
    mockDeleteUserAccount.mockResolvedValueOnce(undefined)
    render(<DeleteAccountDialog />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/password/i), 'my-password')
    await user.click(screen.getByRole('button', { name: /delete account/i }))

    expect(mockDeleteUserAccount).toHaveBeenCalledWith('my-password')
  })

  it('shows error message when password confirmation fails', async () => {
    useDeleteAccountDialogStore.getState().open()
    const { AuthError, AuthErrorCode } = await import('@/shared/auth/auth-errors')
    mockDeleteUserAccount.mockRejectedValueOnce(new AuthError(AuthErrorCode.INVALID_CREDENTIALS))
    render(<DeleteAccountDialog />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /delete account/i }))

    await vi.waitFor(() => {
      expect(screen.getByText(/password is incorrect/i)).toBeInTheDocument()
    })
  })
})
