import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { MnemonicDialog } from './MnemonicDialog'

const MNEMONIC = 'abandon ability able about above absent absorb abstract absurd abuse access accident'

describe('MnemonicDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 12 words when open', () => {
    render(<MnemonicDialog open={true} mnemonic={MNEMONIC} onContinue={vi.fn()} />)
    const words = MNEMONIC.split(' ')
    words.forEach((word) => {
      expect(screen.getByText(word)).toBeInTheDocument()
    })
  })

  it('does not render words when closed', () => {
    render(<MnemonicDialog open={false} mnemonic={MNEMONIC} onContinue={vi.fn()} />)
    expect(screen.queryByText('abandon')).not.toBeInTheDocument()
  })

  it('disables continue button when checkbox is unchecked', () => {
    render(<MnemonicDialog open={true} mnemonic={MNEMONIC} onContinue={vi.fn()} />)
    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).toBeDisabled()
  })

  it('enables continue button when checkbox is checked', async () => {
    const user = userEvent.setup()
    render(<MnemonicDialog open={true} mnemonic={MNEMONIC} onContinue={vi.fn()} />)

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).toBeEnabled()
  })

  it('calls onContinue when continue is clicked after acknowledging', async () => {
    const onContinue = vi.fn()
    const user = userEvent.setup()
    render(<MnemonicDialog open={true} mnemonic={MNEMONIC} onContinue={onContinue} />)

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    const continueButton = screen.getByRole('button', { name: 'Continue' })
    await user.click(continueButton)

    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('displays warning text in the warning banner', () => {
    render(<MnemonicDialog open={true} mnemonic={MNEMONIC} onContinue={vi.fn()} />)
    const warnings = screen.getAllByText('Store this seed phrase securely. It cannot be recovered if lost.')
    expect(warnings.length).toBeGreaterThanOrEqual(1)
  })

  it('copies mnemonic to clipboard on copy button click', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    })

    render(<MnemonicDialog open={true} mnemonic={MNEMONIC} onContinue={vi.fn()} />)

    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    copyButton.click()

    expect(writeTextSpy).toHaveBeenCalledWith(MNEMONIC)
  })

  it('renders copy and download buttons', () => {
    render(<MnemonicDialog open={true} mnemonic={MNEMONIC} onContinue={vi.fn()} />)
    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download as text file/i })).toBeInTheDocument()
  })
})
