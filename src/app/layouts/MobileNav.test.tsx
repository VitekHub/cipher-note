import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { render, screen } from '@/test/utils'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/shared/crypto/vault-dialog-store'

const { mockLockVault } = vi.hoisted(() => ({
  mockLockVault: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/shared/crypto/key-vault', () => ({
  keyVault: {
    lockVault: mockLockVault,
  },
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

  it('calls lockVault when lock button is clicked while unlocked', async () => {
    useCryptoStore.setState({ isVaultLocked: false })
    const user = userEvent.setup()
    render(<MobileNav />)
    await user.click(screen.getByRole('button', { name: /lock vault/i }))
    expect(mockLockVault).toHaveBeenCalledOnce()
  })

  it('opens unlock dialog when unlock button is clicked while locked', async () => {
    useCryptoStore.setState({ isVaultLocked: true })
    useVaultDialogStore.setState({ isUnlockDialogOpen: false })
    const user = userEvent.setup()
    render(<MobileNav />)
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))
    expect(useVaultDialogStore.getState().isUnlockDialogOpen).toBe(true)
    expect(mockLockVault).not.toHaveBeenCalled()
  })
})
