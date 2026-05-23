import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { DecryptionError } from '@/shared/crypto/errors'

const { mockUnlockVault } = vi.hoisted(() => ({
  mockUnlockVault: vi.fn(),
}))

vi.mock('@/features/encryption/model/vault-lock', () => ({
  lockVault: vi.fn(),
  unlockVault: mockUnlockVault,
}))

import { VaultUnlockDialog } from './VaultUnlockDialog'

describe('VaultUnlockDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCryptoStore.setState({ isVaultLocked: true })
  })

  it('renders dialog when vault is locked', () => {
    render(<VaultUnlockDialog />)
    expect(screen.getByText('Vault Locked')).toBeInTheDocument()
  })

  it('does not render dialog when vault is unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    render(<VaultUnlockDialog />)
    expect(screen.queryByText('Vault Locked')).not.toBeInTheDocument()
  })

  it('renders password input and unlock button', () => {
    render(<VaultUnlockDialog />)
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
  })

  it('calls unlockVault with password on submit', async () => {
    mockUnlockVault.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    await user.type(screen.getByLabelText(/password/i), 'my-password')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    expect(mockUnlockVault).toHaveBeenCalledWith('my-password')
  })

  it('shows loading spinner during unlock', async () => {
    let resolveUnlock: () => void = () => {}
    mockUnlockVault.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveUnlock = resolve
      }),
    )
    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    await user.type(screen.getByLabelText(/password/i), 'my-password')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    expect(screen.getByText('Unlocking...')).toBeInTheDocument()

    resolveUnlock()
    await waitFor(() => {
      expect(screen.queryByText('Unlocking...')).not.toBeInTheDocument()
    })
  })

  it('shows error message on wrong password', async () => {
    mockUnlockVault.mockRejectedValue(new DecryptionError())
    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    await user.type(screen.getByLabelText(/password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    await waitFor(() => {
      expect(screen.getByText('Wrong password')).toBeInTheDocument()
    })
  })

  it('shows error message on network error', async () => {
    mockUnlockVault.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    await user.type(screen.getByLabelText(/password/i), 'my-password')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    await waitFor(() => {
      expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
    })
  })

  it('shows generic error message on unexpected error', async () => {
    mockUnlockVault.mockRejectedValue(new Error('something unexpected'))
    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    await user.type(screen.getByLabelText(/password/i), 'my-password')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    await waitFor(() => {
      expect(screen.getByText('Decryption failed. Your data may be corrupted.')).toBeInTheDocument()
    })
  })
})
