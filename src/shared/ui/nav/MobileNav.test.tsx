import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@/test/utils'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => vi.fn(),
}))

import { MobileNav } from './MobileNav'

describe('MobileNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard nav item', () => {
    render(<MobileNav />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders settings nav item', () => {
    render(<MobileNav />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders vault unlock button when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true })
    render(<MobileNav />)
    expect(screen.getByRole('button', { name: /unlock vault/i })).toBeInTheDocument()
  })

  it('renders vault lock button when vault is unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    render(<MobileNav />)
    expect(screen.getByRole('button', { name: /lock vault/i })).toBeInTheDocument()
  })
})
