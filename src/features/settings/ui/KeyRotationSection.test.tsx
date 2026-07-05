import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useRotateFieldKeyDialogStore } from '@/shared/auth/auth-dialogs-store'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'
import { KeyRotationSection } from './KeyRotationSection'

function envelopeWith(versions: Partial<Record<string, number>>): CachedVaultEnvelope {
  const base = [
    { fieldName: 'title', version: 1, wrappedFieldKey: '01'.repeat(48), fieldKeyIV: '02'.repeat(12) },
    { fieldName: 'note', version: 1, wrappedFieldKey: '03'.repeat(48), fieldKeyIV: '04'.repeat(12) },
    { fieldName: 'website', version: 1, wrappedFieldKey: '05'.repeat(48), fieldKeyIV: '06'.repeat(12) },
    { fieldName: 'email', version: 1, wrappedFieldKey: '07'.repeat(48), fieldKeyIV: '08'.repeat(12) },
  ]
  return {
    kdfSalt: 'a1b2c3d4'.repeat(4),
    wrappedMasterKey: 'aa'.repeat(48),
    masterKeyIV: 'bb'.repeat(12),
    fieldKeys: base.map((k) => ({ ...k, version: versions[k.fieldName] ?? k.version })),
  }
}

function setUnlocked(envelope: CachedVaultEnvelope) {
  useCryptoStore.setState({ isVaultLocked: false, cachedEnvelope: envelope })
}

describe('KeyRotationSection', () => {
  beforeEach(() => {
    useRotateFieldKeyDialogStore.setState({ isOpen: false, payload: null })
  })

  it('renders four field rows with versions read from the cached envelope', () => {
    setUnlocked(envelopeWith({ note: 2 }))

    render(<KeyRotationSection />)

    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Website')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()

    // title, website, email at v1; note at v2.
    expect(screen.getAllByText('v1')).toHaveLength(3)
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('shows v1 for every field when the cached envelope has no field keys', () => {
    useCryptoStore.setState({ isVaultLocked: false, cachedEnvelope: null })

    render(<KeyRotationSection />)

    expect(screen.getAllByText('v1')).toHaveLength(4)
  })

  it('disables all rotate buttons and shows the unlock hint when the vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true, cachedEnvelope: envelopeWith({}) })

    render(<KeyRotationSection />)

    for (const button of screen.getAllByRole('button', { name: 'Rotate' })) {
      expect(button).toBeDisabled()
    }
    expect(screen.getByRole('button', { name: 'Rotate all field keys' })).toBeDisabled()
    expect(screen.getByText('Unlock the vault to rotate keys')).toBeInTheDocument()
  })

  it('does not show the unlock hint when the vault is unlocked', () => {
    setUnlocked(envelopeWith({}))

    render(<KeyRotationSection />)

    expect(screen.queryByText('Unlock the vault to rotate keys')).not.toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: 'Rotate' })) {
      expect(button).toBeEnabled()
    }
  })

  it('opens the rotation dialog for a single field when clicking "Rotate"', async () => {
    const user = userEvent.setup()
    setUnlocked(envelopeWith({}))

    render(<KeyRotationSection />)

    await user.click(screen.getAllByRole('button', { name: 'Rotate' })[1]!) // Note row

    expect(useRotateFieldKeyDialogStore.getState().isOpen).toBe(true)
    expect(useRotateFieldKeyDialogStore.getState().payload).toEqual({ fieldName: 'note' })
  })

  it('opens the rotate-all dialog when clicking "Rotate all field keys"', async () => {
    const user = userEvent.setup()
    setUnlocked(envelopeWith({}))

    render(<KeyRotationSection />)

    await user.click(screen.getByRole('button', { name: 'Rotate all field keys' }))

    expect(useRotateFieldKeyDialogStore.getState().isOpen).toBe(true)
    expect(useRotateFieldKeyDialogStore.getState().payload).toEqual({ fieldName: null })
  })

  it('reflects an updated version when the cached envelope changes', () => {
    setUnlocked(envelopeWith({ note: 1 }))

    render(<KeyRotationSection />)

    expect(screen.queryByText('v2')).not.toBeInTheDocument()
    expect(screen.getAllByText('v1')).toHaveLength(4)

    act(() => {
      useCryptoStore.setState({ cachedEnvelope: envelopeWith({ note: 2 }) })
    })

    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getAllByText('v1')).toHaveLength(3)
  })
})
