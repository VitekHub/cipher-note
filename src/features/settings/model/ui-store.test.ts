import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from './ui-store'

describe('ui-store', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarOpen: true, activeField: null })
  })

  it('initializes with sidebarOpen true and activeField null', () => {
    const state = useUiStore.getState()
    expect(state.sidebarOpen).toBe(true)
    expect(state.activeField).toBeNull()
  })

  it('toggleSidebar flips sidebarOpen', () => {
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarOpen).toBe(false)

    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarOpen).toBe(true)
  })

  it('setSidebarOpen sets the value directly', () => {
    useUiStore.getState().setSidebarOpen(false)
    expect(useUiStore.getState().sidebarOpen).toBe(false)

    useUiStore.getState().setSidebarOpen(true)
    expect(useUiStore.getState().sidebarOpen).toBe(true)
  })

  it('setActiveField updates activeField', () => {
    useUiStore.getState().setActiveField('note')
    expect(useUiStore.getState().activeField).toBe('note')

    useUiStore.getState().setActiveField('email')
    expect(useUiStore.getState().activeField).toBe('email')

    useUiStore.getState().setActiveField(null)
    expect(useUiStore.getState().activeField).toBeNull()
  })
})
