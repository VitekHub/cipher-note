import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { useAuthStore } from '@/features/auth/model/auth-store'

import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('renders page heading', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders all section titles', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Preferences')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('About')).toBeInTheDocument()
  })

  it('renders sections in Account → Preferences → Security → About order', () => {
    const { container } = render(<SettingsPage />)
    const sectionTitles = Array.from(container.querySelectorAll('[data-slot="card-title"]'))
    const titleTexts = sectionTitles.map((el) => el.textContent)
    expect(titleTexts).toEqual(['Account', 'Preferences', 'Security', 'Sessions', 'About'])
  })

  it('renders username from auth store in account section', () => {
    useAuthStore.setState({ user: { id: '1', username: 'alice', createdAt: '2024-01-01T00:00:00Z' } })
    render(<SettingsPage />)
    expect(screen.getByText('alice')).toBeInTheDocument()
  })
})
