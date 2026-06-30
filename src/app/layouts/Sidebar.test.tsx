import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { render, screen } from '@/test/utils'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'

const { mockNavigate, mockLockVault, mockIsSaving, mockSubscribe } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLockVault: vi.fn(),
  mockIsSaving: vi.fn(() => false),
  mockSubscribe: vi.fn<(callback: () => void) => () => void>().mockImplementation(() => vi.fn()),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}))

vi.mock('@/shared/crypto/vault/key-vault', () => ({
  keyVault: {
    lockVault: mockLockVault,
  },
}))

vi.mock('@/features/fields/model/use-entry', () => ({
  useEntries: () => ({ data: [] }),
  useCreateEntry: () => vi.fn(),
}))

vi.mock('@/features/fields/model/sync-status-store', () => {
  const storeFn = Object.assign(() => ({ getState: () => ({ resetAll: vi.fn() }) }), { subscribe: mockSubscribe })
  return {
    useSyncStatusStore: storeFn,
    useFieldSyncStatus: () => 'idle',
    isSaving: mockIsSaving,
    isPaused: vi.fn(() => false),
  }
})

import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('calls lockVault and onClose when lock button is clicked while unlocked', async () => {
    const onClose = vi.fn()
    useCryptoStore.setState({ isVaultLocked: false })
    const user = userEvent.setup()
    render(<Sidebar onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /lock vault/i }))
    expect(mockLockVault).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows spinner and Locking... when lock is clicked while saves are in progress', async () => {
    mockIsSaving.mockReturnValue(true)
    useCryptoStore.setState({ isVaultLocked: false })
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /lock vault/i }))
    expect(screen.getByRole('button', { name: /locking/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /locking/i })).toHaveAttribute('disabled')
    const spinner = screen.getByRole('button', { name: /locking/i }).querySelector('svg')
    expect(spinner).toHaveClass('animate-spin')
    expect(mockLockVault).not.toHaveBeenCalled()
    mockIsSaving.mockReturnValue(false)
  })

  it('locks vault when saves complete after deferring', async () => {
    let saving = true
    mockIsSaving.mockImplementation(() => saving)
    useCryptoStore.setState({ isVaultLocked: false })
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /lock vault/i }))
    expect(mockLockVault).not.toHaveBeenCalled()
    // Simulate saves completing
    saving = false
    // Trigger the subscription callback registered by VaultLockButton
    const subscriptionCallback = mockSubscribe.mock.calls[0][0]
    subscriptionCallback()
    await vi.waitFor(() => {
      expect(mockLockVault).toHaveBeenCalledOnce()
    })
  })

  it('opens unlock dialog when unlock button is clicked while locked', async () => {
    useCryptoStore.setState({ isVaultLocked: true })
    useVaultDialogStore.setState({ isUnlockDialogOpen: false })
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))
    expect(useVaultDialogStore.getState().isUnlockDialogOpen).toBe(true)
    expect(mockLockVault).not.toHaveBeenCalled()
  })

  it('calls onClose when unlock button is clicked while locked', async () => {
    const onClose = vi.fn()
    useCryptoStore.setState({ isVaultLocked: true })
    useVaultDialogStore.setState({ isUnlockDialogOpen: false })
    const user = userEvent.setup()
    render(<Sidebar onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))
    expect(onClose).toHaveBeenCalledOnce()
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
