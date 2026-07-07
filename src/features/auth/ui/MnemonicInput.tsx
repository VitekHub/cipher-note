import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'
import { getBip39Wordlist } from '@/shared/crypto/keys/mnemonic'

const WORD_COUNT = 12

interface MnemonicInputProps {
  value: string[]
  onChange: (words: string[]) => void
  disabled?: boolean
  error?: string
  /** Called whenever all-words-filled-and-valid status changes. */
  onValidityChange?: (valid: boolean) => void
}

function MnemonicInput({ value, onChange, disabled, error, onValidityChange }: MnemonicInputProps) {
  const { t } = useTranslation('auth')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [invalidWords, setInvalidWords] = useState<Set<number>>(new Set())

  const allFilled = value.length === WORD_COUNT && value.every((w) => w.trim() !== '')
  const valid = allFilled && invalidWords.size === 0

  // Notify parent only when validity actually changes
  useEffect(() => {
    onValidityChange?.(valid)
  }, [valid, onValidityChange])

  function handleChange(index: number, word: string) {
    const newWords = [...value]
    newWords[index] = word
    onChange(newWords)

    // Clear invalid state for this word when user types
    if (invalidWords.has(index)) {
      const next = new Set(invalidWords)
      next.delete(index)
      setInvalidWords(next)
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ' ') {
      e.preventDefault()
      // Auto-advance on Space if there's content in current input
      if (value[index]?.trim()) {
        inputRefs.current[index + 1]?.focus()
      }
    }
    // Tab naturally advances to the next input, no special handling needed
  }

  async function handleBlur(index: number) {
    const word = value[index]?.trim().toLowerCase()
    if (!word) {
      // Remove from invalid set if empty
      if (invalidWords.has(index)) {
        const next = new Set(invalidWords)
        next.delete(index)
        setInvalidWords(next)
      }
      return
    }
    const wordlist = await getBip39Wordlist()
    const isInvalid = !wordlist.has(word)
    const next = new Set(invalidWords)
    if (isInvalid) {
      next.add(index)
    } else {
      next.delete(index)
    }
    setInvalidWords(next)
  }

  function handlePaste(startIndex: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text')
    if (!pasted) return

    const words = pasted.trim().split(/\s+/)
    // Only intercept paste if it looks like a multi-word paste
    if (words.length > 1) {
      e.preventDefault()
      const newWords = [...value]
      for (let i = 0; i < words.length && startIndex + i < WORD_COUNT; i++) {
        newWords[startIndex + i] = words[i]
      }
      onChange(newWords)

      // Focus the next empty input after the pasted words, or the last input
      const nextIndex = Math.min(startIndex + words.length, WORD_COUNT - 1)
      inputRefs.current[nextIndex]?.focus()

      // Clear invalid states for pasted words (will re-validate on blur)
      const next = new Set(invalidWords)
      for (let i = 0; i < words.length && startIndex + i < WORD_COUNT; i++) {
        next.delete(startIndex + i)
      }
      setInvalidWords(next)
    }
    // Single-word paste: let default browser behavior handle it
  }

  const hasInvalidWords = invalidWords.size > 0

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: WORD_COUNT }, (_, index) => {
          const isInvalid = invalidWords.has(index)
          return (
            <Input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="text"
              autoComplete="off"
              placeholder={t('recover.wordPlaceholder', { number: index + 1 })}
              value={value[index] ?? ''}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onBlur={() => handleBlur(index)}
              onPaste={(e) => handlePaste(index, e)}
              disabled={disabled}
              aria-label={`Word ${index + 1}`}
              className={cn('font-mono', isInvalid && 'border-destructive')}
            />
          )
        })}
      </div>
      {hasInvalidWords ? (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {t('recover.errors.invalidMnemonic')}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export { MnemonicInput }
