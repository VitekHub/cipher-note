import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { useAuthStore } from '@/features/auth/model/auth-store'

import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('renders page heading', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders all three section titles', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Preferences')).toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()
  })

  it('renders username from auth store in account section', () => {
    useAuthStore.setState({ user: { id: '1', username: 'alice', createdAt: '2024-01-01T00:00:00Z' } })
    render(<SettingsPage />)
    expect(screen.getByText('alice')).toBeInTheDocument()
  })
})
