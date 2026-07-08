import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface LayoutState {
  sidebarOpen: boolean
  activeField: string | null
  sidebarWidth: number
}

interface LayoutActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setActiveField: (fieldName: string | null) => void
  setSidebarWidth: (width: number) => void
}

const useLayoutStore = create<LayoutState & LayoutActions>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: false,
        activeField: null,
        sidebarWidth: 240,
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'layout/toggleSidebar'),
        setSidebarOpen: (open) => set({ sidebarOpen: open }, false, 'layout/setSidebarOpen'),
        setActiveField: (fieldName) => set({ activeField: fieldName }, false, 'layout/setActiveField'),
        setSidebarWidth: (width) => set({ sidebarWidth: width }, false, 'layout/setSidebarWidth'),
      }),
      {
        name: 'cipher-note-layout',
        version: 0,
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          sidebarWidth: state.sidebarWidth,
        }),
      },
    ),
    { name: 'LayoutStore' },
  ),
)

export { useLayoutStore }
export type { LayoutState, LayoutActions }
