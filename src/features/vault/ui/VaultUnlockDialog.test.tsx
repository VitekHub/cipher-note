import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { DecryptionError } from '@/shared/crypto/errors'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'

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

  it('calls keyVault.unlockVault with user id and password', async () => {
    mockUnlockVault.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    await user.type(screen.getByLabelText(/password/i), 'my-password')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    expect(mockUnlockVault).toHaveBeenCalledWith(mockUser.id, 'my-password')
  })

  it('maps DecryptionError to vault error message', async () => {
    mockUnlockVault.mockRejectedValue(new DecryptionError())
    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    // getVaultErrorMessage maps DecryptionError → "Wrong password"
    expect(screen.getByText('Wrong password')).toBeInTheDocument()
  })

  it('maps network error to vault error message', async () => {
    mockUnlockVault.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    render(<VaultUnlockDialog />)

    await user.type(screen.getByLabelText(/password/i), 'pw')
    await user.click(screen.getByRole('button', { name: /unlock/i }))

    // getVaultErrorMessage maps network error → "Network error. Please try again."
    expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
  })
})
