import { describe, it, expect, beforeEach } from 'vitest'
import { useLayoutStore } from './layout-store'

describe('layout-store', () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarOpen: false, activeField: null, sidebarWidth: 240 })
  })

  it('initializes with sidebarOpen false, activeField null, sidebarWidth 240', () => {
    const state = useLayoutStore.getState()
    expect(state.sidebarOpen).toBe(false)
    expect(state.activeField).toBeNull()
    expect(state.sidebarWidth).toBe(240)
  })

  it('toggleSidebar flips sidebarOpen', () => {
    useLayoutStore.getState().toggleSidebar()
    expect(useLayoutStore.getState().sidebarOpen).toBe(true)

    useLayoutStore.getState().toggleSidebar()
    expect(useLayoutStore.getState().sidebarOpen).toBe(false)
  })

  it('setSidebarOpen sets the value directly', () => {
    useLayoutStore.getState().setSidebarOpen(false)
    expect(useLayoutStore.getState().sidebarOpen).toBe(false)

    useLayoutStore.getState().setSidebarOpen(true)
    expect(useLayoutStore.getState().sidebarOpen).toBe(true)
  })

  it('setActiveField updates activeField', () => {
    useLayoutStore.getState().setActiveField('note')
    expect(useLayoutStore.getState().activeField).toBe('note')

    useLayoutStore.getState().setActiveField('email')
    expect(useLayoutStore.getState().activeField).toBe('email')

    useLayoutStore.getState().setActiveField(null)
    expect(useLayoutStore.getState().activeField).toBeNull()
  })

  it('setSidebarWidth updates sidebarWidth', () => {
    useLayoutStore.getState().setSidebarWidth(300)
    expect(useLayoutStore.getState().sidebarWidth).toBe(300)

    useLayoutStore.getState().setSidebarWidth(200)
    expect(useLayoutStore.getState().sidebarWidth).toBe(200)
  })
})
