import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@/test/utils'
import { useAuthStore } from '@/features/auth/model/auth-store'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  Outlet: () => React.createElement('div', { 'data-testid': 'outlet' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/features/auth/model/auth-credentials', () => ({
  logoutUser: vi.fn(),
}))

import { ProtectedLayout } from './ProtectedLayout'

describe('ProtectedLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: '1', username: 'testuser', createdAt: '2024-01-01' },
    })
  })

  it('renders vault indicator in header', () => {
    render(<ProtectedLayout />)
    expect(screen.getByText('Vault locked')).toBeInTheDocument()
  })

  it('renders hamburger menu button', () => {
    render(<ProtectedLayout />)
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
  })
})
