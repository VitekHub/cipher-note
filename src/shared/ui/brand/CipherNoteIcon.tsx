// Import as raw string (?raw) because jsdom's createElement doesn't support
// the data-URI component names that Vite generates for ?react imports.
// dangerouslySetInnerHTML is safe here — the SVG is a committed static asset,
// not user-supplied content, so there is no XSS risk.
import iconRaw from '@/shared/assets/cipher-note-icon.svg?raw'
import { cn } from '@/shared/lib/utils'

function CipherNoteIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-5 [&>svg]:size-full', className)}
      dangerouslySetInnerHTML={{ __html: iconRaw }}
    />
  )
}

export { CipherNoteIcon }
