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
