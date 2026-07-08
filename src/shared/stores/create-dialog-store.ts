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

interface PayloadDialogStore<TPayload> {
  isOpen: boolean
  payload: TPayload | null
  open: (payload: TPayload) => void
  close: () => void
}

/**
 * Like createDialogStore, but `open(payload)` stashes a payload the dialog reads
 * when it renders. Use for dialogs that need to know *what* they're acting on
 * (e.g. which field to rotate). `close()` clears the payload.
 */
export function createDialogStoreWithPayload<TPayload>(name: string) {
  return create<PayloadDialogStore<TPayload>>()(
    devtools(
      (set) => ({
        isOpen: false,
        payload: null,
        open: (payload: TPayload) => set({ isOpen: true, payload }, false, `${name}/open`),
        close: () => set({ isOpen: false, payload: null }, false, `${name}/close`),
      }),
      { name },
    ),
  )
}
