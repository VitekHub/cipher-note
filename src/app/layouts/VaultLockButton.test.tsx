import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@/test/utils'
import userEvent from '@testing-library/user-event'

// Mock key-vault
const mockLockVault = vi.fn()

vi.mock('@/shared/crypto/vault/key-vault', () => ({
  keyVault: {
    lockVault: mockLockVault,
  },
}))

// Mock crypto-store
const mockIsVaultLocked = vi.fn(() => false)

vi.mock('@/shared/crypto/vault/crypto-store', () => ({
  useCryptoStore: vi.fn((selector) => selector({ isVaultLocked: mockIsVaultLocked() })),
}))

// Mock vault-dialog-store
const mockOpenUnlockDialog = vi.fn()

vi.mock('@/features/vault/model/vault-dialog-store', () => ({
  useVaultDialogStore: vi.fn((selector) => selector({ openUnlockDialog: mockOpenUnlockDialog })),
}))

// Mock sync-status-store
const mockIsSaving = vi.fn(() => false)
const mockSubscribe = vi.fn<(callback: () => void) => () => void>().mockImplementation(() => vi.fn())

vi.mock('@/features/fields/model/sync-status-store', async () => {
  const actual = await vi.importActual('@/features/fields/model/sync-status-store')
  const storeFn = Object.assign(vi.fn(), { subscribe: mockSubscribe })
  return {
    ...actual,
    isSaving: mockIsSaving,
    useSyncStatusStore: storeFn,
  }
})

// Mock sonner
const mockToastLoading = vi.fn(() => 'toast-id')
const mockToastDismiss = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    loading: mockToastLoading,
    dismiss: mockToastDismiss,
  },
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => {
    if (ns === 'vault') {
      return {
        t: (key: string) => {
          if (key === 'lock') return 'Lock vault'
          if (key === 'unlock') return 'Unlock vault'
          if (key === 'locking') return 'Locking...'
          return key
        },
      }
    }
    if (ns === 'fields') {
      return {
        t: (key: string) => {
          if (key === 'status.saving') return 'Saving...'
          return key
        },
      }
    }
    return { t: (key: string) => key }
  },
}))

const { VaultLockButton } = await import('./VaultLockButton')

describe('VaultLockButton', () => {
  const mockOnBeforeToggle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVaultLocked.mockReturnValue(false)
    mockIsSaving.mockReturnValue(false)
  })

  it('renders lock icon and "Lock vault" label when vault is unlocked (variant=label)', () => {
    render(<VaultLockButton variant="label" />)
    expect(screen.getByText('Lock vault')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lock vault/i })).toBeInTheDocument()
  })

  it('renders unlock icon and "Unlock vault" label when vault is locked (variant=label)', () => {
    mockIsVaultLocked.mockReturnValue(true)
    render(<VaultLockButton variant="label" />)
    expect(screen.getByText('Unlock vault')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unlock vault/i })).toBeInTheDocument()
  })

  it('renders icon-only button with variant=icon — has aria-label', () => {
    render(<VaultLockButton variant="icon" />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Lock vault')
  })

  it('calls keyVault.lockVault immediately when clicked and not saving', async () => {
    const user = userEvent.setup()
    render(<VaultLockButton variant="label" />)

    await user.click(screen.getByRole('button'))

    expect(mockLockVault).toHaveBeenCalledOnce()
  })

  it('calls onBeforeToggle before lock action', async () => {
    const user = userEvent.setup()
    render(<VaultLockButton variant="label" onBeforeToggle={mockOnBeforeToggle} />)

    await user.click(screen.getByRole('button'))

    expect(mockOnBeforeToggle).toHaveBeenCalledOnce()
    expect(mockLockVault).toHaveBeenCalledOnce()
  })

  it('calls openUnlockDialog when clicked while vault is locked', async () => {
    mockIsVaultLocked.mockReturnValue(true)
    const user = userEvent.setup()
    render(<VaultLockButton variant="label" />)

    await user.click(screen.getByRole('button'))

    expect(mockOpenUnlockDialog).toHaveBeenCalledOnce()
    expect(mockLockVault).not.toHaveBeenCalled()
  })

  it('shows spinner and "Locking..." label when saves are in progress (isSaving returns true)', async () => {
    mockIsSaving.mockReturnValue(true)
    const user = userEvent.setup()
    render(<VaultLockButton variant="label" />)

    await user.click(screen.getByRole('button'))

    expect(screen.getByText('Locking...')).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('disables button when isLocking is true', async () => {
    mockIsSaving.mockReturnValue(true)
    const user = userEvent.setup()
    render(<VaultLockButton variant="label" />)

    await user.click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('locks vault and clears isLocking when saves complete (transition from SAVING to IDLE)', async () => {
    mockIsSaving.mockReturnValue(true)
    let subscriptionCallback: (() => void) | undefined
    mockSubscribe.mockImplementation((callback: () => void) => {
      subscriptionCallback = callback
      return vi.fn()
    })

    const user = userEvent.setup()
    render(<VaultLockButton variant="label" />)

    await user.click(screen.getByRole('button'))

    expect(mockLockVault).not.toHaveBeenCalled()

    // Simulate saves completing — isSaving now returns false
    mockIsSaving.mockReturnValue(false)
    act(() => {
      subscriptionCallback?.()
    })

    await vi.waitFor(() => {
      expect(mockLockVault).toHaveBeenCalledOnce()
    })
  })

  it('dismisses toast when saves complete', async () => {
    mockIsSaving.mockReturnValue(true)
    let subscriptionCallback: (() => void) | undefined
    mockSubscribe.mockImplementation((callback: () => void) => {
      subscriptionCallback = callback
      return vi.fn()
    })

    const user = userEvent.setup()
    render(<VaultLockButton variant="label" />)

    await user.click(screen.getByRole('button'))

    expect(mockToastLoading).toHaveBeenCalled()

    // Simulate saves completing
    mockIsSaving.mockReturnValue(false)
    act(() => {
      subscriptionCallback?.()
    })

    expect(mockToastDismiss).toHaveBeenCalledWith('toast-id')
  })

  it('registers subscription when locking while saves are in progress', async () => {
    mockIsSaving.mockReturnValue(true)

    const user = userEvent.setup()
    render(<VaultLockButton variant="label" />)

    await user.click(screen.getByRole('button'))

    expect(mockSubscribe).toHaveBeenCalledOnce()
  })
})
