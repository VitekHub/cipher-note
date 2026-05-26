import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { useAuthStore } from '@/features/auth/model/auth-store'

import { AccountSection } from './AccountSection'

describe('AccountSection', () => {
  it('renders section title and description', () => {
    render(<AccountSection />)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Manage your account settings.')).toBeInTheDocument()
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

  it('renders delete account button as disabled', () => {
    render(<AccountSection />)
    const deleteButton = screen.getByRole('button', { name: /delete account/i })
    expect(deleteButton).toBeDisabled()
  })
})
