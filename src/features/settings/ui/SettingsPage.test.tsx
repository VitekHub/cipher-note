import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { useAuthStore } from '@/features/auth/model/auth-store'

// SessionSection is lazy-loaded and calls getActiveSessions on mount.
// Mock the session API so the component doesn't make a real Supabase call
// (which would fail without env vars and slow down the test).
vi.mock('@/shared/api/supabase-session', () => ({
  getActiveSessions: vi.fn(() => Promise.resolve([])),
  revokeSession: vi.fn(() => Promise.resolve(true)),
  revokeOtherSessions: vi.fn(() => Promise.resolve(0)),
  isSessionValid: vi.fn(() => Promise.resolve(true)),
}))

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

  it('renders sections in Account → Preferences → Security → About → Sessions order', async () => {
    const { container } = render(<SettingsPage />)
    // SessionSection is lazy-loaded, wait for it to appear
    await screen.findByText('Sessions', {}, { timeout: 5000 })
    const sectionTitles = Array.from(container.querySelectorAll('[data-slot="card-title"]'))
    const titleTexts = sectionTitles.map((el) => el.textContent)
    expect(titleTexts).toEqual(['Account', 'Preferences', 'Security', 'About', 'Sessions'])
  })

  it('renders username from auth store in account section', () => {
    useAuthStore.setState({ user: { id: '1', username: 'alice', createdAt: '2024-01-01T00:00:00Z' } })
    render(<SettingsPage />)
    expect(screen.getByText('alice')).toBeInTheDocument()
  })
})
