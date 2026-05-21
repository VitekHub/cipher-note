import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import React from 'react'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!')
    await user.type(screen.getByLabelText(/confirm password/i), 'Password1!')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('abandon')).toBeInTheDocument()
    })
  })

  it('shows password strength indicator below password field', () => {
    render(<RegisterPage onSubmit={vi.fn().mockResolvedValue(undefined)} />)

    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('shows error toast on submit failure', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('User already registered'))
    const { toast } = await import('sonner')

    render(<RegisterPage onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!')
    await user.type(screen.getByLabelText(/confirm password/i), 'Password1!')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Username already taken')
    })
  })
})
