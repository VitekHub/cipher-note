import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { useRegenerateMnemonicDialogStore, useVerifyMnemonicDialogStore } from '@/shared/stores/dialogs-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useVaultSettingsStore, DEFAULT_VAULT_TIMEOUT_MS } from '@/shared/stores/vault-settings-store'
import { SecuritySection } from './SecuritySection'

describe('SecuritySection', () => {
  beforeEach(() => {
    useRegenerateMnemonicDialogStore.setState({ isOpen: false })
    useVerifyMnemonicDialogStore.setState({ isOpen: false })
    useCryptoStore.setState({ isVaultLocked: true, cachedEnvelope: null, loadedFieldKeys: {} })
    useVaultSettingsStore.setState({ vaultTimeoutMs: DEFAULT_VAULT_TIMEOUT_MS, lockOnTabHidden: false })
  })

  it('renders section title and description', () => {
    render(<SecuritySection />)
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Manage vault, encryption keys, and seed phrase.')).toBeInTheDocument()
  })

  it('renders the seed phrase action items', () => {
    render(<SecuritySection />)
    expect(screen.getByText('Regenerate seed phrase')).toBeInTheDocument()
    expect(screen.getByText('Verify seed phrase')).toBeInTheDocument()
  })

  it('renders Key management trigger', () => {
    render(<SecuritySection />)
    expect(screen.getByText('Key management')).toBeInTheDocument()
  })

  it('does not render Change password in SecuritySection', () => {
    render(<SecuritySection />)
    expect(screen.queryByText('Change password')).not.toBeInTheDocument()
  })

  it('renders separator dividers between action items and Key management', () => {
    render(<SecuritySection />)
    const separators = screen.getAllByRole('separator')
    expect(separators.length).toBeGreaterThanOrEqual(2)
  })

  it('opens regenerate mnemonic dialog when clicking "Regenerate seed phrase"', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const seedPhraseButton = screen.getByRole('button', { name: /Regenerate seed phrase/i })
    await user.click(seedPhraseButton)

    expect(useRegenerateMnemonicDialogStore.getState().isOpen).toBe(true)
  })

  it('opens verify mnemonic dialog when clicking "Verify seed phrase"', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const verifyButton = screen.getByRole('button', { name: /Verify seed phrase/i })
    await user.click(verifyButton)

    expect(useVerifyMnemonicDialogStore.getState().isOpen).toBe(true)
  })

  it('renders the auto-lock select with timeout options', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const select = screen.getByRole('combobox', { name: 'Auto-lock vault' })
    expect(select).toBeInTheDocument()
    expect(select).toHaveTextContent('15 min')

    await user.click(select)
    // Options are rendered via a portal asynchronously
    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(5)
  })

  it('updates vaultTimeoutMs when the auto-lock selection changes', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const select = screen.getByRole('combobox', { name: 'Auto-lock vault' })
    await user.click(select)
    // Options are rendered via a portal asynchronously
    const fiveMinOption = await screen.findByRole('option', { name: '5 min' })
    await user.click(fiveMinOption)

    expect(useVaultSettingsStore.getState().vaultTimeoutMs).toBe(5 * 60 * 1000)
  })

  it('renders the tab-lock checkbox unchecked by default', () => {
    render(<SecuritySection />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('toggles lockOnTabHidden when the checkbox is clicked', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(useVaultSettingsStore.getState().lockOnTabHidden).toBe(true)

    await user.click(checkbox)
    expect(useVaultSettingsStore.getState().lockOnTabHidden).toBe(false)
  })
})
