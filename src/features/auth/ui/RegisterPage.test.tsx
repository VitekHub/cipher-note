import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/shared/lib/use-debounced-value', () => ({
  useDebouncedValue: (value: unknown) => value,
}))

const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null })

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({ rpc: mockRpc }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => vi.fn(),
}))

import { RegisterPage } from './RegisterPage'

const MNEMONIC = 'abandon ability able about above absent absorb abstract absurd abuse access accident'

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks clears call history but not implementations; restore the
    // default "available" response so a per-test override can't leak forward.
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('renders registration form fields', () => {
    render(<RegisterPage onSubmit={vi.fn().mockResolvedValue(undefined)} />)

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  it('opens mnemonic dialog on successful submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(MNEMONIC)

    render(<RegisterPage onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await waitFor(() => {
      expect(screen.getByText(/username is available/i)).toBeInTheDocument()
    })
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!')
    await user.type(screen.getByLabelText(/confirm password/i), 'Password1!')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('abandon')).toBeInTheDocument()
    })
  })

  it('shows password strength indicator in popover when password field is focused', async () => {
    const user = userEvent.setup()
    render(<RegisterPage onSubmit={vi.fn().mockResolvedValue(undefined)} />)

    const passwordInput = screen.getByLabelText(/^password$/i)
    await user.click(passwordInput)
    await user.keyboard('a')

    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('shows error toast on submit failure', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new AuthError(AuthErrorCode.USERNAME_TAKEN))
    const { toast } = await import('sonner')

    render(<RegisterPage onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await waitFor(() => {
      expect(screen.getByText(/username is available/i)).toBeInTheDocument()
    })
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!')
    await user.type(screen.getByLabelText(/confirm password/i), 'Password1!')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Username already taken')
    })
  })

  it('shows validation error for short password', async () => {
    const user = userEvent.setup()
    render(<RegisterPage onSubmit={vi.fn().mockResolvedValue(undefined)} />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await waitFor(() => {
      expect(screen.getByText(/username is available/i)).toBeInTheDocument()
    })
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })
  })

  it('shows validation error for password mismatch', async () => {
    const user = userEvent.setup()
    render(<RegisterPage onSubmit={vi.fn().mockResolvedValue(undefined)} />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await waitFor(() => {
      expect(screen.getByText(/username is available/i)).toBeInTheDocument()
    })
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid username pattern', async () => {
    const user = userEvent.setup()
    render(<RegisterPage onSubmit={vi.fn().mockResolvedValue(undefined)} />)

    await user.type(screen.getByLabelText(/username/i), 'Bad Username!')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/letters/i)).toBeInTheDocument()
    })
  })

  it('displays link to login page', () => {
    render(<RegisterPage onSubmit={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByText(/log in/i)).toBeInTheDocument()
  })

  it('disables submit and shows the taken badge when the username is already taken', async () => {
    // check_username_availability returns false → useUsernameAvailability
    // status flips to 'taken' → the "Username is already taken" badge renders
    // and isSubmitDisabled (availability === 'taken') disables the submit
    // button, blocking the registration attempt before it reaches onSubmit.
    mockRpc.mockResolvedValue({ data: false, error: null })
    const user = userEvent.setup()

    render(<RegisterPage onSubmit={vi.fn().mockResolvedValue(undefined)} />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')

    await waitFor(() => {
      expect(screen.getByText(/username is already taken/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
  })
})
