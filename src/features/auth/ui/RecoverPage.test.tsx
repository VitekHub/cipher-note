import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import React from 'react'

const { mockValidateMnemonic, mockSetNewPassword, mockClear } = vi.hoisted(() => ({
  mockValidateMnemonic: vi.fn(),
  mockSetNewPassword: vi.fn(),
  mockClear: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/features/auth/model/mnemonic-service', () => ({
  recoveryFlow: {
    validateMnemonic: mockValidateMnemonic,
    setNewPassword: mockSetNewPassword,
    clear: mockClear,
  },
}))

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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => vi.fn(),
}))

import { RecoverPage } from './RecoverPage'
import { DecryptionError, MnemonicError } from '@/shared/crypto/core/errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { toast } from 'sonner'

describe('RecoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateMnemonic.mockResolvedValue(undefined)
    mockSetNewPassword.mockResolvedValue(undefined)
  })

  // ── Step 1: Mnemonic form ─────────────────────────────────────────

  it('renders username input and MnemonicInput in step 1', () => {
    render(<RecoverPage />)

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    // MnemonicInput renders 12 textboxes with word number placeholders
    expect(screen.getByPlaceholderText('1')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recover account/i })).toBeInTheDocument()
  })

  it('displays back to login link in step 1', () => {
    render(<RecoverPage />)

    expect(screen.getByText(/back to login/i)).toBeInTheDocument()
  })

  it('step 1 submit calls recoveryFlow.validateMnemonic with username and mnemonic', async () => {
    const user = userEvent.setup()
    render(<RecoverPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')

    // Fill all 12 mnemonic inputs via paste
    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste('abandon ability able about above absent absorb abstract absurd abuse access accident')

    // Wait for validity callback
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover account/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /recover account/i }))

    await waitFor(() => {
      expect(mockValidateMnemonic).toHaveBeenCalledWith(
        'testuser',
        'abandon ability able about above absent absorb abstract absurd abuse access accident',
      )
    })
  })

  it('step 1 submit with wrong mnemonic shows error below MnemonicInput', async () => {
    mockValidateMnemonic.mockRejectedValueOnce(new DecryptionError())
    const user = userEvent.setup()
    render(<RecoverPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste('abandon ability able about above absent absorb abstract absurd abuse access accident')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover account/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /recover account/i }))

    await waitFor(() => {
      expect(screen.getByText(/seed phrase does not match/i)).toBeInTheDocument()
    })
  })

  it('step 1 submit with MnemonicError shows invalid mnemonic error', async () => {
    mockValidateMnemonic.mockRejectedValueOnce(new MnemonicError())
    const user = userEvent.setup()
    render(<RecoverPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste('abandon ability able about above absent absorb abstract absurd abuse access accident')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover account/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /recover account/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid seed phrase/i)).toBeInTheDocument()
    })
  })

  it('step 1 submit with account not found shows error toast', async () => {
    mockValidateMnemonic.mockRejectedValueOnce(new ApiError(ApiErrorCode.NOT_FOUND))
    const user = userEvent.setup()
    render(<RecoverPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste('abandon ability able about above absent absorb abstract absurd abuse access accident')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover account/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /recover account/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Account not found. Please check your username.')
    })
  })

  it('step 1 submit with network error shows error toast', async () => {
    mockValidateMnemonic.mockRejectedValueOnce(new AuthError(AuthErrorCode.NETWORK_ERROR))
    const user = userEvent.setup()
    render(<RecoverPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste('abandon ability able about above absent absorb abstract absurd abuse access accident')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover account/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /recover account/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Network error. Please try again.')
    })
  })

  it('successful validation transitions to step 2', async () => {
    const user = userEvent.setup()
    render(<RecoverPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste('abandon ability able about above absent absorb abstract absurd abuse access accident')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover account/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /recover account/i }))

    await waitFor(() => {
      // Step 2 renders a description unique to step 2
      expect(screen.getByText(/create a new password/i)).toBeInTheDocument()
    })

    // Step 2 should have the password fields
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /set new password/i })).toBeInTheDocument()
  })

  // ── Step 2: New Password form ──────────────────────────────────────

  it('step 2 submit calls recoveryFlow.setNewPassword with new password', async () => {
    const user = userEvent.setup()
    render(<RecoverPage />)

    // Complete step 1
    await user.type(screen.getByLabelText(/username/i), 'testuser')

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste('abandon ability able about above absent absorb abstract absurd abuse access accident')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover account/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /recover account/i }))

    // Wait for step 2
    await waitFor(() => {
      expect(screen.getByText(/create a new password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('New password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /set new password/i }))

    await waitFor(() => {
      expect(mockSetNewPassword).toHaveBeenCalledWith('newpassword123')
    })
  })

  it('step 2 submit success calls setNewPassword and navigate', async () => {
    const user = userEvent.setup()
    render(<RecoverPage />)

    // Complete step 1
    await user.type(screen.getByLabelText(/username/i), 'testuser')

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste('abandon ability able about above absent absorb abstract absurd abuse access accident')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover account/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /recover account/i }))

    await waitFor(() => {
      expect(screen.getByText(/create a new password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('New password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /set new password/i }))

    await waitFor(() => {
      expect(mockSetNewPassword).toHaveBeenCalledWith('newpassword123')
    })
  })

  it('step 2 submit failure shows error toast', async () => {
    mockSetNewPassword.mockRejectedValueOnce(new AuthError(AuthErrorCode.INVALID_CREDENTIALS))
    const user = userEvent.setup()
    render(<RecoverPage />)

    // Complete step 1
    await user.type(screen.getByLabelText(/username/i), 'testuser')

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.paste('abandon ability able about above absent absorb abstract absurd abuse access accident')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover account/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /recover account/i }))

    await waitFor(() => {
      expect(screen.getByText(/create a new password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('New password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /set new password/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Recovery failed. Please try again.')
    })
  })

  // ── Cleanup ────────────────────────────────────────────────────────

  it('calls recoveryFlow.clear on component unmount', () => {
    const { unmount } = render(<RecoverPage />)
    expect(mockClear).not.toHaveBeenCalled()

    unmount()

    expect(mockClear).toHaveBeenCalled()
  })
})
