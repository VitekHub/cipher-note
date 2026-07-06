import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

// Mock mnemonic-service
vi.mock('@/features/auth/model/mnemonic-service', () => ({
  verifyMnemonic: vi.fn(),
  RecoveryLoginError: class RecoveryLoginError extends Error {
    constructor(cause?: Error) {
      super('Recovery succeeded but automatic login failed', { cause })
      this.name = 'RecoveryLoginError'
    }
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock getBip39Wordlist for MnemonicInput validation
vi.mock('@/shared/crypto/keys/mnemonic', () => ({
  getBip39Wordlist: vi
    .fn()
    .mockResolvedValue(
      new Set([
        'abandon',
        'ability',
        'able',
        'about',
        'above',
        'absent',
        'absorb',
        'abstract',
        'absurd',
        'abuse',
        'access',
        'accident',
      ]),
    ),
}))

import { VerifyMnemonicDialog } from './VerifyMnemonicDialog'
import { verifyMnemonic } from '@/features/auth/model/mnemonic-service'
import { useVerifyMnemonicDialogStore } from '@/shared/auth/auth-dialogs-store'
import { toast } from 'sonner'

const mockVerifyMnemonic = vi.mocked(verifyMnemonic)

const VALID_MNEMONIC = 'abandon ability able about above absent absorb abstract absurd abuse access accident'

describe('VerifyMnemonicDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useVerifyMnemonicDialogStore.setState({ isOpen: true })
  })

  it('renders dialog when open', () => {
    render(<VerifyMnemonicDialog />)

    expect(screen.getByText('Verify Seed Phrase')).toBeInTheDocument()
    expect(screen.getByText('Enter your seed phrase to verify it matches your recovery data.')).toBeInTheDocument()
  })

  it('does not render dialog content when closed', () => {
    useVerifyMnemonicDialogStore.setState({ isOpen: false })
    render(<VerifyMnemonicDialog />)

    expect(screen.queryByText('Verify Seed Phrase')).not.toBeInTheDocument()
  })

  it('shows success toast and closes dialog when mnemonic is correct', async () => {
    const user = userEvent.setup()
    mockVerifyMnemonic.mockResolvedValueOnce(true)

    render(<VerifyMnemonicDialog />)

    // Paste a valid 12-word mnemonic
    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste(VALID_MNEMONIC)

    // Wait for MnemonicInput validity check and submit button to be enabled
    const submitButton = screen.getByRole('button', { name: /verify/i })
    await user.click(submitButton)

    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Your recovery phrase is valid')
      expect(useVerifyMnemonicDialogStore.getState().isOpen).toBe(false)
    })
  })

  it('shows failure error when mnemonic is wrong', async () => {
    const user = userEvent.setup()
    mockVerifyMnemonic.mockResolvedValueOnce(false)

    render(<VerifyMnemonicDialog />)

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste(VALID_MNEMONIC)

    const submitButton = screen.getByRole('button', { name: /verify/i })
    await user.click(submitButton)

    await vi.waitFor(() => {
      expect(screen.getByText(/does not match/i)).toBeInTheDocument()
    })
  })

  it('shows network error when verifyMnemonic throws network error', async () => {
    const user = userEvent.setup()
    const { ApiError, ApiErrorCode } = await import('@/shared/api/api-errors')
    mockVerifyMnemonic.mockRejectedValueOnce(new ApiError(ApiErrorCode.NETWORK_ERROR))

    render(<VerifyMnemonicDialog />)

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste(VALID_MNEMONIC)

    const submitButton = screen.getByRole('button', { name: /verify/i })
    await user.click(submitButton)

    await vi.waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('shows not found error when verifyMnemonic throws NOT_FOUND', async () => {
    const user = userEvent.setup()
    const { ApiError, ApiErrorCode } = await import('@/shared/api/api-errors')
    mockVerifyMnemonic.mockRejectedValueOnce(new ApiError(ApiErrorCode.NOT_FOUND))

    render(<VerifyMnemonicDialog />)

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste(VALID_MNEMONIC)

    const submitButton = screen.getByRole('button', { name: /verify/i })
    await user.click(submitButton)

    await vi.waitFor(() => {
      expect(screen.getByText(/account not found/i)).toBeInTheDocument()
    })
  })

  it('shows unexpected error on unknown error', async () => {
    const user = userEvent.setup()
    mockVerifyMnemonic.mockRejectedValueOnce(new Error('Something unexpected'))

    render(<VerifyMnemonicDialog />)

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste(VALID_MNEMONIC)

    const submitButton = screen.getByRole('button', { name: /verify/i })
    await user.click(submitButton)

    await vi.waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument()
    })
  })

  it('closes dialog on cancel button click', async () => {
    const user = userEvent.setup()
    render(<VerifyMnemonicDialog />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(useVerifyMnemonicDialogStore.getState().isOpen).toBe(false)
  })

  it('blocks close during submission', async () => {
    let resolveVerify!: (value: boolean) => void
    mockVerifyMnemonic.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveVerify = resolve
      }),
    )

    const user = userEvent.setup()
    render(<VerifyMnemonicDialog />)

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste(VALID_MNEMONIC)

    const submitButton = screen.getByRole('button', { name: /verify/i })
    await user.click(submitButton)

    // Escape should not close the dialog during submission
    await user.keyboard('{Escape}')
    expect(useVerifyMnemonicDialogStore.getState().isOpen).toBe(true)

    // Clean up: resolve the promise
    resolveVerify(true)
  })

  it('clears error when user types new input after failure', async () => {
    const user = userEvent.setup()
    mockVerifyMnemonic.mockResolvedValueOnce(false)

    render(<VerifyMnemonicDialog />)

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste(VALID_MNEMONIC)

    const submitButton = screen.getByRole('button', { name: /verify/i })
    await user.click(submitButton)

    // Wait for failure error to appear
    await vi.waitFor(() => {
      expect(screen.getByText(/does not match/i)).toBeInTheDocument()
    })

    // Type in the first input to clear the error
    await user.type(firstInput, 'a')

    // Error should be cleared
    expect(screen.queryByText(/does not match/i)).not.toBeInTheDocument()
  })
})
