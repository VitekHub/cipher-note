import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/shared/crypto/vault-dialog-store'
import { DecryptionError } from '@/shared/crypto/errors'

const { mockUnlockVault } = vi.hoisted(() => ({
  mockUnlockVault: vi.fn(),
}))

vi.mock('@/shared/crypto/key-vault', () => ({
  keyVault: {
    unlockVault: mockUnlockVault,
  },
}))

// Mock auth context — keep real AuthContext (needed by AuthProvider), mock useAuth
vi.mock('@/shared/auth/auth-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/auth/auth-context')>()
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

import { VaultUnlockDialog } from './VaultUnlockDialog'
import { useAuth } from '@/shared/auth/auth-context'

describe('VaultUnlockDialog', () => {
  const mockUser = { id: 'user-1', username: 'testuser' }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset stores to clean state
    useCryptoStore.getState().clearVault()
    useCryptoStore.setState({ isVaultLocked: true })
    useVaultDialogStore.setState({ isUnlockDialogOpen: true })
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      isLoading: false,
      isRestoringSession: false,
      adapter: {} as import('@/shared/auth/auth.types').IAuthAdapter,
    })
  })

  it('renders dialog when isUnlockDialogOpen is true', () => {
    render(<VaultUnlockDialog />)
    expect(screen.getByText('Vault Locked')).toBeInTheDocument()
  })

  it('does not render dialog content when isUnlockDialogOpen is false', () => {
    useVaultDialogStore.setState({ isUnlockDialogOpen: false })
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

    expect(mockUnlockVault).toHaveBeenCalledWith(mockUser.id, 'my-password')
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
      expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument()
    })
  })

  it('shows full description', () => {
    // State is already reset in beforeEach: isVaultLocked=true, envelope fields null
    render(<VaultUnlockDialog />)
    expect(screen.getByText('Enter your password to unlock your vault.')).toBeInTheDocument()
  })

  it('closes dialog and resets form when vault unlocks', async () => {
    mockUnlockVault.mockResolvedValue(undefined)
    useVaultDialogStore.setState({ isUnlockDialogOpen: true })
    useCryptoStore.setState({ isVaultLocked: true })

    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    await user.type(screen.getByLabelText(/password/i), 'my-password')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    // Simulate vault unlocking
    useCryptoStore.setState({ isVaultLocked: false })

    await waitFor(() => {
      expect(useVaultDialogStore.getState().isUnlockDialogOpen).toBe(false)
    })
  })

  it('closes dialog when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    // The dialog close button has aria-label "Close"
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    expect(useVaultDialogStore.getState().isUnlockDialogOpen).toBe(false)
  })
})
