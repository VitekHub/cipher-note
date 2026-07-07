import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useRotateFieldKeyDialogStore } from '@/shared/auth/auth-dialogs-store'
import { KeyManagementSubsection } from './KeyManagementSubsection'

const unlockedState = {
  isVaultLocked: false,
  cachedEnvelope: null,
}

describe('KeyManagementSubsection', () => {
  beforeEach(() => {
    useCryptoStore.setState({ isVaultLocked: true, cachedEnvelope: null, loadedFieldKeys: {} })
    useRotateFieldKeyDialogStore.setState({ isOpen: false, payload: null })
  })

  it('renders collapsed by default with trigger visible', () => {
    render(<KeyManagementSubsection />)
    expect(screen.getByText('Key management')).toBeInTheDocument()
  })

  it('expands on trigger click to show field rows with version badges', async () => {
    useCryptoStore.setState(unlockedState)
    const user = userEvent.setup()
    render(<KeyManagementSubsection />)

    await user.click(screen.getByText('Key management'))

    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Website')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('shows v1 for fields when no cached envelope', async () => {
    useCryptoStore.setState(unlockedState)
    const user = userEvent.setup()
    render(<KeyManagementSubsection />)

    await user.click(screen.getByText('Key management'))

    const versionBadges = screen.getAllByText('v1')
    expect(versionBadges).toHaveLength(4)
  })

  it('disables rotate buttons and shows locked hint when vault is locked', async () => {
    const user = userEvent.setup()
    render(<KeyManagementSubsection />)

    await user.click(screen.getByText('Key management'))

    const rotateButtons = screen.getAllByRole('button', { name: 'Rotate' })
    rotateButtons.forEach((btn) => expect(btn).toBeDisabled())

    const rotateAllButton = screen.getByRole('button', { name: /Rotate all field keys/i })
    expect(rotateAllButton).toBeDisabled()

    expect(screen.getByText('Unlock the vault to rotate keys')).toBeInTheDocument()
  })

  it('opens rotation dialog for single field on Rotate click', async () => {
    useCryptoStore.setState(unlockedState)
    const user = userEvent.setup()
    render(<KeyManagementSubsection />)

    await user.click(screen.getByText('Key management'))
    const rotateButtons = screen.getAllByRole('button', { name: 'Rotate' })
    await user.click(rotateButtons[0])

    expect(useRotateFieldKeyDialogStore.getState().isOpen).toBe(true)
    expect(useRotateFieldKeyDialogStore.getState().payload).toEqual({ fieldName: 'title' })
  })

  it('opens rotate-all dialog on Rotate all field keys click', async () => {
    useCryptoStore.setState(unlockedState)
    const user = userEvent.setup()
    render(<KeyManagementSubsection />)

    await user.click(screen.getByText('Key management'))
    await user.click(screen.getByRole('button', { name: /Rotate all field keys/i }))

    expect(useRotateFieldKeyDialogStore.getState().isOpen).toBe(true)
    expect(useRotateFieldKeyDialogStore.getState().payload).toEqual({ fieldName: null })
  })

  it('reflects updated versions when cached envelope changes', async () => {
    useCryptoStore.setState({
      isVaultLocked: false,
      cachedEnvelope: {
        kdfSalt: 'abc',
        wrappedMasterKey: 'def',
        masterKeyIV: 'ghi',
        fieldKeys: [
          { fieldName: 'title', version: 3, wrappedFieldKey: 'a', fieldKeyIV: 'b' },
          { fieldName: 'note', version: 2, wrappedFieldKey: 'c', fieldKeyIV: 'd' },
          { fieldName: 'website', version: 1, wrappedFieldKey: 'e', fieldKeyIV: 'f' },
          { fieldName: 'email', version: 4, wrappedFieldKey: 'g', fieldKeyIV: 'h' },
        ],
      },
    })
    const user = userEvent.setup()
    render(<KeyManagementSubsection />)

    await user.click(screen.getByText('Key management'))

    expect(screen.getByText('v3')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('v4')).toBeInTheDocument()
  })
})
