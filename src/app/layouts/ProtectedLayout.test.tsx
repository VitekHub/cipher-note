import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@/test/utils'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useLayoutStore } from './layout-store'
import { useCryptoStore } from '@/shared/crypto/crypto-store'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  Outlet: () => React.createElement('div', { 'data-testid': 'outlet' }),
  useNavigate: () => vi.fn(),
  useParams: vi.fn(() => ({})),
}))

vi.mock('@/features/vault/ui/VaultUnlockDialog', () => ({
  VaultUnlockDialog: () => React.createElement('div', { 'data-testid': 'vault-unlock-dialog' }),
}))

vi.mock('@/features/vault/model/vault-timeout', () => ({
  useVaultTimeout: () => {},
}))

vi.mock('@/features/fields/model/use-entry', () => ({
  useEntries: vi.fn(() => ({ data: [] })),
  useCreateEntry: vi.fn(() => vi.fn()),
}))

import { ProtectedLayout } from './ProtectedLayout'

describe('ProtectedLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: '1', username: 'testuser', createdAt: '2024-01-01' },
    })
    useLayoutStore.setState({ sidebarOpen: false, activeField: null, sidebarWidth: 240 })
    useCryptoStore.setState({ isVaultLocked: false })
  })

  it('renders vault indicator in header', () => {
    render(<ProtectedLayout />)
    expect(screen.getByText('Vault unlocked')).toBeInTheDocument()
  })

  it('renders hamburger menu button', () => {
    render(<ProtectedLayout />)
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
  })

  it('renders desktop sidebar with dynamic width', () => {
    useLayoutStore.setState({ sidebarWidth: 300 })
    render(<ProtectedLayout />)
    const aside = screen.getByRole('complementary')
    expect(aside).toHaveStyle({ width: '300px' })
  })

  it('renders resize handle', () => {
    render(<ProtectedLayout />)
    const handle = document.querySelector('[data-slot="resize-handle"]')
    expect(handle).toBeInTheDocument()
  })

  it('renders vault unlock dialog', () => {
    render(<ProtectedLayout />)
    expect(screen.getByTestId('vault-unlock-dialog')).toBeInTheDocument()
  })
})
