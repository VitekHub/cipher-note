import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useChangePasswordDialogStore } from '@/shared/auth/auth-dialogs-store'

import { AccountSection } from './AccountSection'

describe('AccountSection', () => {
  beforeEach(() => {
    useChangePasswordDialogStore.setState({ isOpen: false })
  })

  it('renders section title and description', () => {
    render(<AccountSection />)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Manage your account and login credentials.')).toBeInTheDocument()
  })

  it('displays username from auth store', () => {
    useAuthStore.setState({ user: { id: '1', username: 'testuser', createdAt: '2024-01-01T00:00:00Z' } })
    render(<AccountSection />)
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('displays dash when no user is logged in', () => {
    useAuthStore.setState({ user: null })
    render(<AccountSection />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders Change password button', () => {
    render(<AccountSection />)
    expect(screen.getByRole('button', { name: /Change password/i })).toBeInTheDocument()
  })

  it('opens change password dialog when clicking "Change password"', async () => {
    const user = userEvent.setup()
    render(<AccountSection />)

    await user.click(screen.getByRole('button', { name: /Change password/i }))

    expect(useChangePasswordDialogStore.getState().isOpen).toBe(true)
  })

  it('renders delete account item as inactive (no onClick handler)', () => {
    render(<AccountSection />)
    expect(screen.getByText('Delete account')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete account/i })).not.toBeInTheDocument()
  })
})
