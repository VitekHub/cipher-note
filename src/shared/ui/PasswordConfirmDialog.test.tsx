import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { PasswordConfirmDialog } from './PasswordConfirmDialog'

function renderDialog(overrides: Partial<Parameters<typeof PasswordConfirmDialog>[0]> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    mapError: (err: unknown) => (err instanceof Error ? err.message : 'Unknown error'),
    title: 'Confirm Action',
    description: 'Please enter your password.',
    submitLabel: 'Confirm',
    isSubmittingLabel: 'Confirming...',
    ...overrides,
  }
  const result = render(<PasswordConfirmDialog {...props} />)
  return { ...result, props }
}

describe('PasswordConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title and description when open', () => {
    renderDialog()
    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Please enter your password.')).toBeInTheDocument()
  })

  it('does not render content when isOpen is false', () => {
    renderDialog({ isOpen: false })
    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument()
  })

  it('renders password input and submit button', () => {
    renderDialog()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('calls onConfirm with entered password on submit', async () => {
    const { props } = renderDialog()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/password/i), 'my-secret')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(props.onConfirm).toHaveBeenCalledWith('my-secret')
  })

  it('shows isSubmittingLabel during submission and hides on resolve', async () => {
    let resolve!: () => void
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    renderDialog({ onConfirm })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/password/i), 'pw')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(screen.getByText('Confirming...')).toBeInTheDocument()

    resolve()
    await waitFor(() => {
      expect(screen.queryByText('Confirming...')).not.toBeInTheDocument()
    })
  })

  it('displays mapped error message on rejection', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('custom error msg'))
    const mapError = vi.fn((err: unknown) => (err instanceof Error ? err.message : 'Unknown error'))
    renderDialog({ onConfirm, mapError })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/password/i), 'pw')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByText('custom error msg')).toBeInTheDocument()
    })
    expect(mapError).toHaveBeenCalled()
  })

  it('calls onClose and resets form when submission succeeds', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderDialog({ onClose, onConfirm })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/password/i), 'pw')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    renderDialog({ onClose })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it('resets password input and error when dialog is closed', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('fail'))
    renderDialog({ onConfirm })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/password/i), 'pw')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByText('fail')).toBeInTheDocument()
    })

    // Close and reopen
    await user.click(screen.getByRole('button', { name: /close/i }))
  })

  it('hides close button and blocks Escape during submission', async () => {
    let resolve!: () => void
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const onClose = vi.fn()
    renderDialog({ onConfirm, onClose })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/password/i), 'pw')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    // Close button hidden during submission
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()

    // Escape does not close
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()

    resolve()
  })
})
