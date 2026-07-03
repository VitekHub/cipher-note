import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { useChangePasswordDialogStore, useRegenerateMnemonicDialogStore } from '@/shared/auth/auth-dialogs-store'
import { SecuritySection } from './SecuritySection'

describe('SecuritySection', () => {
  beforeEach(() => {
    useChangePasswordDialogStore.setState({ isOpen: false })
    useRegenerateMnemonicDialogStore.setState({ isOpen: false })
  })

  it('renders section title and description', () => {
    render(<SecuritySection />)
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Manage your password and security settings.')).toBeInTheDocument()
  })

  it('renders three action items', () => {
    render(<SecuritySection />)
    expect(screen.getByText('Change password')).toBeInTheDocument()
    expect(screen.getByText('Regenerate seed phrase')).toBeInTheDocument()
    expect(screen.getByText('Key versions')).toBeInTheDocument()
  })

  it('renders three separator dividers between action items', () => {
    render(<SecuritySection />)
    const separators = screen.getAllByRole('separator')
    expect(separators).toHaveLength(3)
  })

  it('opens change password dialog when clicking "Change password"', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const changePasswordButton = screen.getByRole('button', { name: /Change password/i })
    await user.click(changePasswordButton)

    expect(useChangePasswordDialogStore.getState().isOpen).toBe(true)
  })

  it('opens change password dialog with Space key', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const changePasswordButton = screen.getByRole('button', { name: /Change password/i })
    changePasswordButton.focus()
    await user.keyboard(' ')

    expect(useChangePasswordDialogStore.getState().isOpen).toBe(true)
  })

  it('opens regenerate mnemonic dialog when clicking "Regenerate seed phrase"', async () => {
    const user = userEvent.setup()
    render(<SecuritySection />)

    const seedPhraseButton = screen.getByRole('button', { name: /Regenerate seed phrase/i })
    await user.click(seedPhraseButton)

    expect(useRegenerateMnemonicDialogStore.getState().isOpen).toBe(true)
  })
})
