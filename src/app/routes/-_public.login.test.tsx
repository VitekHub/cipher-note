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
    login: vi.fn().mockResolvedValue({
      user: { id: '1', username: 'testuser', createdAt: '2024-01-01' },
      session: { accessToken: 'tok', expiresAt: 0 },
    }),
    signup: vi.fn(),
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

import { LoginPage } from '@/features/auth/ui/LoginPage'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { toast } from 'sonner'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, session: null, isLoading: false })
  })

  it('renders username and password inputs and submit button', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields on submit', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid username pattern', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/username/i), 'Invalid User!')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText(/3-32 lowercase/i)).toBeInTheDocument()
    })
  })

  it('disables inputs and button during submission', async () => {
    vi.mocked(authAdapter.login).mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeDisabled()
      expect(screen.getByLabelText(/password/i)).toBeDisabled()
      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled()
    })
  })

  it('calls loginUser on valid form submission', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(authAdapter.login).toHaveBeenCalled()
    })
  })

  it('shows error toast on login failure', async () => {
    vi.mocked(authAdapter.login).mockRejectedValueOnce(new Error('Invalid login credentials'))
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid username or password')
    })
  })

  it('displays link to register page', () => {
    render(<LoginPage />)
    expect(screen.getByText(/create one/i)).toBeInTheDocument()
  })
})
