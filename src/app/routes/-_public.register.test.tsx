import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import React from 'react'

vi.mock('@/shared/crypto/derive-placeholder', () => ({
  deriveCredentials: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    passwordKey: 'b'.repeat(64),
    keySalt: 'c'.repeat(64),
    authSalt: 'd'.repeat(64),
  }),
}))

vi.mock('@/shared/auth/supabase-adapter', () => ({
  authAdapter: {
    login: vi.fn(),
    signup: vi.fn().mockResolvedValue({
      user: { id: '1', username: 'newuser', createdAt: '2024-01-01' },
      session: { accessToken: 'tok', expiresAt: 0 },
    }),
    logout: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => vi.fn(),
}))

import { RegisterPage } from '@/features/auth/ui/RegisterPage'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { toast } from 'sonner'

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, session: null, isLoading: false })
  })

  it('renders username, password, confirm password inputs and submit button', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows validation error for short password', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for password mismatch', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid username pattern', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'Bad Username!')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/lowercase letters/i)).toBeInTheDocument()
    })
  })

  it('calls registerUser on valid form submission', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(authAdapter.signup).toHaveBeenCalled()
    })
  })

  it('shows error toast on registration failure', async () => {
    vi.mocked(authAdapter.signup).mockRejectedValueOnce(new Error('User already registered'))
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Username already taken')
    })
  })

  it('displays link to login page', () => {
    render(<RegisterPage />)
    expect(screen.getByText(/log in/i)).toBeInTheDocument()
  })
})
