import { useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface NoteFieldProps {
  value: string
  onChange: (value: string) => void
}

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight + 10}px`
}

function NoteField({ value, onChange }: NoteFieldProps) {
  const { t } = useTranslation('fields')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Resize on value changes (initial load, user input, programmatic changes)
  // useLayoutEffect runs before paint, avoiding visual flash
  useLayoutEffect(() => {
    if (textareaRef.current) {
      autoResize(textareaRef.current)
    }
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t('note.label')}
      className="bg-muted/50 border-border focus-visible:border-ring focus-visible:ring-ring/20 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
      placeholder={t('note.placeholder')}
      rows={6}
    />
  )
}

export { NoteField }
