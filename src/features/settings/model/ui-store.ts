import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UiState {
  sidebarOpen: boolean
  activeField: string | null
  sidebarWidth: number
}

interface UiActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setActiveField: (fieldName: string | null) => void
  setSidebarWidth: (width: number) => void
}

const useUiStore = create<UiState & UiActions>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: false,
        activeField: null,
        sidebarWidth: 240,
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'ui/toggleSidebar'),
        setSidebarOpen: (open) => set({ sidebarOpen: open }, false, 'ui/setSidebarOpen'),
        setActiveField: (fieldName) => set({ activeField: fieldName }, false, 'ui/setActiveField'),
        setSidebarWidth: (width) => set({ sidebarWidth: width }, false, 'ui/setSidebarWidth'),
      }),
      {
        name: 'cipher-note-ui',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          sidebarWidth: state.sidebarWidth,
        }),
      },
    ),
    { name: 'UiStore' },
  ),
)

export { useUiStore }
export type { UiState, UiActions }
