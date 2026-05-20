import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

function NoteField() {
  const { t } = useTranslation('fields')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleInput = useCallback(() => {
    if (textareaRef.current) {
      autoResize(textareaRef.current)
    }
  }, [])

  // Resize on mount so pre-filled content (edit mode) gets correct height
  useEffect(() => {
    if (textareaRef.current) {
      autoResize(textareaRef.current)
    }
  }, [])

  return (
    <textarea
      ref={textareaRef}
      aria-label={t('note.label')}
      className="bg-muted/50 border-border focus-visible:border-ring focus-visible:ring-ring/20 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
      placeholder={t('note.placeholder')}
      rows={6}
      onInput={handleInput}
    />
  )
}

export { NoteField }
