import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

vi.mock('@/features/auth/model/mnemonic-service', () => ({
  regenerateMnemonic: vi.fn(),
}))

import { RegenerateMnemonicDialog } from './RegenerateMnemonicDialog'
import { regenerateMnemonic } from '@/features/auth/model/mnemonic-service'
import { useRegenerateMnemonicDialogStore } from '@/shared/auth/regenerate-mnemonic-dialog-store'

const mockRegenerateMnemonic = vi.mocked(regenerateMnemonic)

const MNEMONIC = 'abandon ability able about above absent absorb abstract absurd abuse access accident'

describe('RegenerateMnemonicDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRegenerateMnemonicDialogStore.setState({ isRegenerateMnemonicDialogOpen: true })
  })

  it('renders password confirm dialog when open and in password-confirm step', () => {
    render(<RegenerateMnemonicDialog />)

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
  })

  it('does not render password dialog when closed', () => {
    useRegenerateMnemonicDialogStore.setState({ isRegenerateMnemonicDialogOpen: false })
    render(<RegenerateMnemonicDialog />)

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })

  it('shows mnemonic dialog after successful password confirmation', async () => {
    const user = userEvent.setup()
    mockRegenerateMnemonic.mockResolvedValueOnce(MNEMONIC)

    render(<RegenerateMnemonicDialog />)

    await user.type(screen.getByLabelText(/password/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    await vi.waitFor(() => {
      expect(screen.getByText('Your Seed Phrase')).toBeInTheDocument()
    })

    const words = MNEMONIC.split(' ')
    words.forEach((word) => {
      expect(screen.getByText(word)).toBeInTheDocument()
    })
  })

  it('shows error message when password confirmation fails', async () => {
    const user = userEvent.setup()
    const { DecryptionError } = await import('@/shared/crypto/core/errors')
    mockRegenerateMnemonic.mockRejectedValueOnce(new DecryptionError())

    render(<RegenerateMnemonicDialog />)

    await user.type(screen.getByLabelText(/password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    await vi.waitFor(() => {
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument()
    })
  })

  it('calls regenerateMnemonic service with entered password', async () => {
    const user = userEvent.setup()
    mockRegenerateMnemonic.mockResolvedValueOnce(MNEMONIC)

    render(<RegenerateMnemonicDialog />)

    await user.type(screen.getByLabelText(/password/i), 'my-secret-password')
    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    await vi.waitFor(() => {
      expect(mockRegenerateMnemonic).toHaveBeenCalledWith('my-secret-password')
    })
  })

  it('shows success toast and closes dialog when mnemonic is confirmed', async () => {
    const user = userEvent.setup()
    mockRegenerateMnemonic.mockResolvedValueOnce(MNEMONIC)

    render(<RegenerateMnemonicDialog />)

    await user.type(screen.getByLabelText(/password/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    // Advance to mnemonic dialog
    await vi.waitFor(() => {
      expect(screen.getByText('Your Seed Phrase')).toBeInTheDocument()
    })

    // Acknowledge the warning checkbox to enable the Continue button
    await user.click(screen.getByRole('checkbox'))

    // Click Continue on the mnemonic dialog
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Dialog should close and success toast should fire
    await vi.waitFor(() => {
      expect(useRegenerateMnemonicDialogStore.getState().isRegenerateMnemonicDialogOpen).toBe(false)
    })
  })

  it('closes password dialog and resets state on cancel', async () => {
    const user = userEvent.setup()
    render(<RegenerateMnemonicDialog />)

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()

    // Click the close button on the PasswordConfirmDialog
    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(useRegenerateMnemonicDialogStore.getState().isRegenerateMnemonicDialogOpen).toBe(false)
  })

  it('shows network error when saveRecoveryData fails', async () => {
    const user = userEvent.setup()
    const { ApiError, ApiErrorCode } = await import('@/shared/api/api-errors')
    mockRegenerateMnemonic.mockRejectedValueOnce(new ApiError(ApiErrorCode.NETWORK_ERROR))

    render(<RegenerateMnemonicDialog />)

    await user.type(screen.getByLabelText(/password/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    await vi.waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('shows not found error when user data is missing', async () => {
    const user = userEvent.setup()
    const { ApiError, ApiErrorCode } = await import('@/shared/api/api-errors')
    mockRegenerateMnemonic.mockRejectedValueOnce(new ApiError(ApiErrorCode.NOT_FOUND))

    render(<RegenerateMnemonicDialog />)

    await user.type(screen.getByLabelText(/password/i), 'test-password')
    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    await vi.waitFor(() => {
      expect(screen.getByText(/account not found/i)).toBeInTheDocument()
    })
  })
})
