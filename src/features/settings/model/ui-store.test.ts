import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from './ui-store'

describe('ui-store', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarOpen: false, activeField: null, sidebarWidth: 240 })
  })

  it('initializes with sidebarOpen false, activeField null, sidebarWidth 240', () => {
    const state = useUiStore.getState()
    expect(state.sidebarOpen).toBe(false)
    expect(state.activeField).toBeNull()
    expect(state.sidebarWidth).toBe(240)
  })

  it('toggleSidebar flips sidebarOpen', () => {
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarOpen).toBe(true)

    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarOpen).toBe(false)
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

  it('setSidebarWidth updates sidebarWidth', () => {
    useUiStore.getState().setSidebarWidth(300)
    expect(useUiStore.getState().sidebarWidth).toBe(300)

    useUiStore.getState().setSidebarWidth(200)
    expect(useUiStore.getState().sidebarWidth).toBe(200)
  })
})
