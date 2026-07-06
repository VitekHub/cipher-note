import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface DialogStore {
  isOpen: boolean
  open: () => void
  close: () => void
}

/**
 * Creates a Zustand store for a simple open/close dialog.
 * The store has `isOpen`, `open()`, and `close()`. No domain-specific state.
 */
export function createDialogStore(name: string) {
  return create<DialogStore>()(
    devtools(
      (set) => ({
        isOpen: false,
        open: () => set({ isOpen: true }, false, `${name}/open`),
        close: () => set({ isOpen: false }, false, `${name}/close`),
      }),
      { name },
    ),
  )
}
