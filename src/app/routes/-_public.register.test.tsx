import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import React from 'react'

const { mockHandleRegister } = vi.hoisted(() => ({
  mockHandleRegister: vi
    .fn()
    .mockResolvedValue('word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11'),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/shared/lib/use-debounced-value', () => ({
  useDebouncedValue: (value: unknown) => value,
}))

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => vi.fn(),
}))

import { RegisterPage } from '@/features/auth/ui/RegisterPage'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { toast } from 'sonner'

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, session: null, isLoading: false })
  })

  it('renders username, password, confirm password inputs and submit button', () => {
    render(<RegisterPage onSubmit={mockHandleRegister} />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows validation error for short password', async () => {
    const user = userEvent.setup()
    render(<RegisterPage onSubmit={mockHandleRegister} />)

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
    render(<RegisterPage onSubmit={mockHandleRegister} />)

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
    render(<RegisterPage onSubmit={mockHandleRegister} />)

    await user.type(screen.getByLabelText(/username/i), 'Bad Username!')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/letters/i)).toBeInTheDocument()
    })
  })

  it('calls onSubmit on valid form submission', async () => {
    const user = userEvent.setup()
    render(<RegisterPage onSubmit={mockHandleRegister} />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await waitFor(() => {
      expect(screen.getByText(/username is available/i)).toBeInTheDocument()
    })
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockHandleRegister).toHaveBeenCalledWith('testuser', 'testpass123')
    })
  })

  it('shows error toast on registration failure', async () => {
    mockHandleRegister.mockRejectedValueOnce(new Error('User already registered'))
    const user = userEvent.setup()
    render(<RegisterPage onSubmit={mockHandleRegister} />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await waitFor(() => {
      expect(screen.getByText(/username is available/i)).toBeInTheDocument()
    })
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Username already taken')
    })
  })

  it('displays link to login page', () => {
    render(<RegisterPage onSubmit={mockHandleRegister} />)
    expect(screen.getByText(/log in/i)).toBeInTheDocument()
  })
})
