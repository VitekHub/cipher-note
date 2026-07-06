import { describe, it, expect } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/test/utils'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useVaultDialogStore } from '@/features/vault/model/vault-dialog-store'
import { VaultIndicator } from './VaultIndicator'

describe('VaultIndicator', () => {
  it('shows locked state by default', () => {
    render(<VaultIndicator />)
    expect(screen.getByText('Vault locked')).toBeInTheDocument()
  })

  it('shows unlocked state when vault is unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    render(<VaultIndicator />)
    expect(screen.getByText('Vault unlocked')).toBeInTheDocument()
  })

  it('renders a button when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true })
    render(<VaultIndicator />)
    const button = screen.getByRole('button', { name: /unlock vault/i })
    expect(button).toBeInTheDocument()
  })

  it('renders a div (not button) when vault is unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    render(<VaultIndicator />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Vault unlocked')).toBeInTheDocument()
  })

  it('opens unlock dialog when clicked while locked', async () => {
    useCryptoStore.setState({ isVaultLocked: true })
    useVaultDialogStore.setState({ isOpen: false })
    const user = userEvent.setup()
    render(<VaultIndicator />)
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))
    expect(useVaultDialogStore.getState().isOpen).toBe(true)
  })
})
