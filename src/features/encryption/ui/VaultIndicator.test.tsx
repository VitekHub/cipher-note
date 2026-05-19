import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
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

  it('shows lock icon when locked', () => {
    const { container } = render(<VaultIndicator />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
