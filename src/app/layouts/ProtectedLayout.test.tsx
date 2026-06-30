import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen } from '@/test/utils'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useLayoutStore } from './layout-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  Outlet: () => React.createElement('div', { 'data-testid': 'outlet' }),
  useNavigate: () => vi.fn(),
  useParams: vi.fn(() => ({})),
  useBlocker: vi.fn(() => ({ status: 'idle', proceed: vi.fn() })),
}))

vi.mock('@/features/vault/ui/VaultUnlockDialog', () => ({
  VaultUnlockDialog: () => React.createElement('div', { 'data-testid': 'vault-unlock-dialog' }),
}))

vi.mock('@/features/auth/ui/ChangePasswordDialog', () => ({
  ChangePasswordDialog: () => React.createElement('div', { 'data-testid': 'change-password-dialog' }),
}))

vi.mock('@/features/vault/model/vault-timeout', () => ({
  useVaultTimeout: () => {},
}))

vi.mock('@/features/fields/model/use-navigation-blocker', () => ({
  useNavigationBlocker: vi.fn(),
}))

vi.mock('@/features/fields/model/use-entry', () => ({
  useEntries: vi.fn(() => ({ data: [] })),
  useCreateEntry: vi.fn(() => vi.fn()),
}))

// Realtime subscription is a network side-effect; stub the adapter so rendering
// the layout in tests never opens a real WebSocket.
vi.mock('@/shared/realtime/supabase-realtime', () => ({
  realtimeAdapter: { subscribe: vi.fn(() => Promise.resolve()), unsubscribe: vi.fn() },
}))

import { useNavigationBlocker } from '@/features/fields/model/use-navigation-blocker'
import { useBlocker } from '@tanstack/react-router'
import { ProtectedLayout } from './ProtectedLayout'

/** Matches the modern UseBlockerOpts shape (the legacy overload lacks these properties). */
type BlockerOpts = {
  shouldBlockFn: (...args: unknown[]) => boolean | Promise<boolean>
  enableBeforeUnload?: boolean | (() => boolean)
  withResolver?: boolean
  disabled?: boolean
}

describe('ProtectedLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: '1', username: 'testuser', createdAt: '2024-01-01' },
    })
    useLayoutStore.setState({ sidebarOpen: false, activeField: null, sidebarWidth: 240 })
    useCryptoStore.setState({ isVaultLocked: false })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders vault indicator in header', () => {
    render(<ProtectedLayout />)
    expect(screen.getByText('Vault unlocked')).toBeInTheDocument()
  })

  it('renders hamburger menu button', () => {
    render(<ProtectedLayout />)
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
  })

  it('renders desktop sidebar with dynamic width', () => {
    useLayoutStore.setState({ sidebarWidth: 300 })
    render(<ProtectedLayout />)
    const aside = screen.getByRole('complementary')
    expect(aside).toHaveStyle({ width: '300px' })
  })

  it('renders resize handle', () => {
    render(<ProtectedLayout />)
    const handle = document.querySelector('[data-slot="resize-handle"]')
    expect(handle).toBeInTheDocument()
  })

  it('renders vault unlock dialog', () => {
    render(<ProtectedLayout />)
    expect(screen.getByTestId('vault-unlock-dialog')).toBeInTheDocument()
  })

  it('renders change password dialog', () => {
    render(<ProtectedLayout />)
    expect(screen.getByTestId('change-password-dialog')).toBeInTheDocument()
  })

  it('calls useNavigationBlocker', () => {
    render(<ProtectedLayout />)
    expect(useNavigationBlocker).toHaveBeenCalled()
  })

  // --- Offline blocker ---

  it('calls useBlocker with offline blocker config', () => {
    render(<ProtectedLayout />)

    const offlineCall = vi
      .mocked(useBlocker)
      .mock.calls.find((call) => (call[0] as unknown as BlockerOpts).enableBeforeUnload === false)
    expect(offlineCall).toBeDefined()
    expect((offlineCall![0] as unknown as BlockerOpts).withResolver).toBe(false)
    expect((offlineCall![0] as unknown as BlockerOpts).shouldBlockFn).toBeInstanceOf(Function)
  })

  it('offline blocker shouldBlockFn returns false when online', () => {
    render(<ProtectedLayout />)

    const offlineCall = vi
      .mocked(useBlocker)
      .mock.calls.find((call) => (call[0] as unknown as BlockerOpts).enableBeforeUnload === false)
    expect((offlineCall![0] as unknown as BlockerOpts).shouldBlockFn()).toBe(false)
  })

  it('offline blocker shouldBlockFn returns true when offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    render(<ProtectedLayout />)

    const offlineCall = vi
      .mocked(useBlocker)
      .mock.calls.find((call) => (call[0] as unknown as BlockerOpts).enableBeforeUnload === false)
    expect((offlineCall![0] as unknown as BlockerOpts).shouldBlockFn()).toBe(true)
  })
})
