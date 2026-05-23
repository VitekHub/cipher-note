import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { render, screen } from '@/test/utils'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'

const { mockNavigate, mockLockVault } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLockVault: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => mockNavigate,
}))

vi.mock('@/features/encryption/model/vault-lock', () => ({
  lockVault: mockLockVault,
}))

import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nav items', () => {
    render(<Sidebar />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders app logo', () => {
    render(<Sidebar />)
    expect(screen.getByText('Cipher Note')).toBeInTheDocument()
  })

  it('renders logout button', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })

  it('renders vault lock button when vault is unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /lock vault/i })).toBeInTheDocument()
  })

  it('renders vault unlock button when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true })
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /unlock vault/i })).toBeInTheDocument()
  })

  it('calls lockVault when lock button is clicked while unlocked', async () => {
    useCryptoStore.setState({ isVaultLocked: false })
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /lock vault/i }))
    expect(mockLockVault).toHaveBeenCalledOnce()
  })

  it('does not call lockVault when unlock button is clicked while locked', async () => {
    useCryptoStore.setState({ isVaultLocked: true })
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))
    expect(mockLockVault).not.toHaveBeenCalled()
  })

  it('renders user info when user is set', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'testuser', createdAt: '2024-01-01' },
    })
    render(<Sidebar />)
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('renders close button when onClose is provided', () => {
    const onClose = vi.fn()
    render(<Sidebar onClose={onClose} />)
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument()
  })

  it('does not render close button when onClose is not provided', () => {
    render(<Sidebar />)
    expect(screen.queryByRole('button', { name: /close menu/i })).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Sidebar onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /close menu/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onLogout and navigates to /login after logout', async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Sidebar onLogout={onLogout} />)
    await user.click(screen.getByRole('button', { name: /log out/i }))
    expect(onLogout).toHaveBeenCalledOnce()
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
  })
})
