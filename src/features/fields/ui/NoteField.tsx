import { useCallback, useRef } from 'react'
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

  return (
    <textarea
      ref={textareaRef}
      className="bg-muted/50 border-border focus:border-ring focus:ring-ring/20 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
      placeholder={t('note.placeholder')}
      rows={6}
      onInput={handleInput}
    />
  )
}

export { NoteField }
