import { cn } from '@/shared/lib/utils'
import iconRaw from '@/shared/assets/cipher-note-icon.svg?raw'

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
