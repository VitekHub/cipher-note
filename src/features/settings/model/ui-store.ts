import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UiState {
  sidebarOpen: boolean
  activeField: string | null
}

interface UiActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setActiveField: (fieldName: string | null) => void
}

const useUiStore = create<UiState & UiActions>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        activeField: null,
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'ui/toggleSidebar'),
        setSidebarOpen: (open) => set({ sidebarOpen: open }, false, 'ui/setSidebarOpen'),
        setActiveField: (fieldName) => set({ activeField: fieldName }, false, 'ui/setActiveField'),
      }),
      {
        name: 'cipher-note-ui',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
        }),
      },
    ),
    { name: 'UiStore' },
  ),
)

export { useUiStore }
export type { UiState, UiActions }
