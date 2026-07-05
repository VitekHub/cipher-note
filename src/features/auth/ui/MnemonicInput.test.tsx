import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

// Mock getBip39Wordlist to return a controlled set of "valid" words for fast tests.
// vi.mock factories are hoisted above all declarations, so the Set must be created inline.
vi.mock('@/shared/crypto/keys/mnemonic', () => ({
  getBip39Wordlist: vi
    .fn()
    .mockResolvedValue(
      new Set([
        'abandon',
        'ability',
        'able',
        'about',
        'above',
        'absent',
        'absorb',
        'abstract',
        'absurd',
        'abuse',
        'access',
        'accident',
        'acid',
        'acoustic',
        'acquire',
        'address',
        'admit',
        'advance',
        'against',
        'agency',
      ]),
    ),
}))

import { MnemonicInput } from './MnemonicInput'

const ALL_VALID = [
  'abandon',
  'ability',
  'able',
  'about',
  'above',
  'absent',
  'absorb',
  'abstract',
  'absurd',
  'abuse',
  'access',
  'accident',
]

function defaultWords(): string[] {
  return Array(12).fill('')
}

describe('MnemonicInput', () => {
  it('renders 12 input fields', () => {
    render(<MnemonicInput value={defaultWords()} onChange={() => {}} />)

    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(12)
  })

  it('each input shows its word number as placeholder', () => {
    render(<MnemonicInput value={defaultWords()} onChange={() => {}} />)

    for (let i = 1; i <= 12; i++) {
      expect(screen.getByPlaceholderText(String(i))).toBeInTheDocument()
    }
  })

  it('typing in an input updates the corresponding word in the value array', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<MnemonicInput value={defaultWords()} onChange={onChange} />)

    const firstInput = screen.getByPlaceholderText('1')
    await user.type(firstInput, 'abandon')

    // Controlled component: each keystroke calls onChange with the updated word.
    // Verify onChange was called and at least one call set word 0 to a non-empty value.
    expect(onChange).toHaveBeenCalled()
    const callsWithWord0 = onChange.mock.calls.filter((call) => call[0][0] !== '')
    expect(callsWithWord0.length).toBeGreaterThan(0)
    expect(callsWithWord0[0][0][0]).toBe('a')
  })

  it('pressing Space in an input with content advances focus to the next input', async () => {
    const user = userEvent.setup()
    const words = defaultWords()
    words[0] = 'abandon'
    render(<MnemonicInput value={words} onChange={() => {}} />)

    const firstInput = screen.getByPlaceholderText('1')
    const secondInput = screen.getByPlaceholderText('2')

    firstInput.focus()
    await user.keyboard(' ')

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(secondInput)
    })
  })

  it('does not advance focus on Space when current input is empty', async () => {
    const user = userEvent.setup()
    render(<MnemonicInput value={defaultWords()} onChange={() => {}} />)

    const firstInput = screen.getByPlaceholderText('1')

    firstInput.focus()
    await user.keyboard(' ')

    expect(document.activeElement).toBe(firstInput)
  })

  it('pressing Tab advances focus to the next input', async () => {
    const user = userEvent.setup()
    const words = defaultWords()
    words[0] = 'abandon'
    render(<MnemonicInput value={words} onChange={() => {}} />)

    const firstInput = screen.getByPlaceholderText('1')
    const secondInput = screen.getByPlaceholderText('2')

    firstInput.focus()
    await user.tab()

    expect(document.activeElement).toBe(secondInput)
  })

  it('pasting a 12-word phrase fills all inputs and calls onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MnemonicInput value={defaultWords()} onChange={onChange} />)

    const phrase = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const firstInput = screen.getByPlaceholderText('1')

    await user.click(firstInput)
    await user.paste(phrase)

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
    const result = lastCall[0] as string[]
    expect(result).toEqual(phrase.split(' '))
  })

  it('pasting a phrase with extra whitespace normalizes and fills inputs', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MnemonicInput value={defaultWords()} onChange={onChange} />)

    const firstInput = screen.getByPlaceholderText('1')

    await user.click(firstInput)
    await user.paste('abandon  ability   able\tabout\nabove  absent\tabsorb  abstract  absurd  abuse  access  accident')

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
    const result = lastCall[0] as string[]
    expect(result).toEqual(ALL_VALID)
  })

  it('words not in the BIP-39 wordlist are highlighted with error styling', async () => {
    const user = userEvent.setup()
    const words = defaultWords()
    words[0] = 'notaword'
    render(<MnemonicInput value={words} onChange={() => {}} />)

    const firstInput = screen.getByPlaceholderText('1')

    // Focus and blur to trigger async wordlist validation
    await user.click(firstInput)
    await user.tab()

    await vi.waitFor(() => {
      expect(firstInput).toHaveClass('border-destructive')
    })
  })

  it('calls onValidityChange with true when all 12 words are valid', async () => {
    const onValidityChange = vi.fn()
    const { rerender } = render(
      <MnemonicInput value={defaultWords()} onChange={() => {}} onValidityChange={onValidityChange} />,
    )

    rerender(<MnemonicInput value={ALL_VALID} onChange={() => {}} onValidityChange={onValidityChange} />)

    await vi.waitFor(() => {
      expect(onValidityChange).toHaveBeenCalledWith(true)
    })
  })

  it('calls onValidityChange with false when some words are empty', async () => {
    const onValidityChange = vi.fn()

    const { rerender } = render(
      <MnemonicInput value={ALL_VALID} onChange={() => {}} onValidityChange={onValidityChange} />,
    )

    await vi.waitFor(() => {
      expect(onValidityChange).toHaveBeenCalledWith(true)
    })

    const someEmpty = [...ALL_VALID]
    someEmpty[2] = ''

    onValidityChange.mockClear()
    rerender(<MnemonicInput value={someEmpty} onChange={() => {}} onValidityChange={onValidityChange} />)

    await vi.waitFor(() => {
      expect(onValidityChange).toHaveBeenCalledWith(false)
    })
  })

  it('calls onValidityChange with false when invalid words are detected via blur', async () => {
    const user = userEvent.setup()
    const onValidityChange = vi.fn()

    const { rerender } = render(
      <MnemonicInput value={ALL_VALID} onChange={() => {}} onValidityChange={onValidityChange} />,
    )

    await vi.waitFor(() => {
      expect(onValidityChange).toHaveBeenCalledWith(true)
    })

    const wordsWithInvalid = [...ALL_VALID]
    wordsWithInvalid[0] = 'notaword'
    rerender(<MnemonicInput value={wordsWithInvalid} onChange={() => {}} onValidityChange={onValidityChange} />)

    const firstInput = screen.getByPlaceholderText('1')
    await user.click(firstInput)
    await user.tab()

    await vi.waitFor(() => {
      expect(firstInput).toHaveClass('border-destructive')
    })

    await vi.waitFor(() => {
      expect(onValidityChange).toHaveBeenCalledWith(false)
    })
  })

  it('error prop displays error message below the grid', () => {
    render(<MnemonicInput value={defaultWords()} onChange={() => {}} error="Wrong seed phrase" />)

    expect(screen.getByText('Wrong seed phrase')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong seed phrase')
  })

  it('disabled prop disables all inputs', () => {
    render(<MnemonicInput value={defaultWords()} onChange={() => {}} disabled />)

    const inputs = screen.getAllByRole('textbox')
    for (const input of inputs) {
      expect(input).toBeDisabled()
    }
  })

  it('clears invalid word styling when user types in the input', async () => {
    const user = userEvent.setup()
    const words = defaultWords()
    words[0] = 'notaword'
    const onChange = vi.fn((newWords: string[]) => {
      Object.assign(words, newWords)
    })

    const { rerender } = render(<MnemonicInput value={words} onChange={onChange} />)

    const firstInput = screen.getByPlaceholderText('1')

    // Blur to trigger validation marking 'notaword' as invalid
    await user.click(firstInput)
    await user.tab()

    await vi.waitFor(() => {
      expect(firstInput).toHaveClass('border-destructive')
    })

    // Typing clears the invalid state for that word index (handleChange)
    await user.click(firstInput)
    await user.type(firstInput, '{Backspace>8}')
    rerender(<MnemonicInput value={words} onChange={onChange} />)

    expect(firstInput).not.toHaveClass('border-destructive')
  })
})
