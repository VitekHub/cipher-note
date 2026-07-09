import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from '@/app/routeTree.gen'
import type { AuthContext } from '@/shared/auth/auth-context'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { useAuthStore } from '@/features/auth/model/auth-store'

// The authenticated layout subscribes to realtime on mount; stub the adapter so
// rendering the route tree in tests never opens a real WebSocket.
vi.mock('@/shared/realtime/supabase-realtime', () => ({
  realtimeAdapter: { subscribe: vi.fn(() => Promise.resolve()), unsubscribe: vi.fn() },
}))

// The authenticated layout subscribes to session update broadcast; stub it
// so rendering the route tree in tests never opens a real channel.
vi.mock('@/shared/realtime/session-update', () => ({
  sessionUpdateChannel: { subscribe: vi.fn(), unsubscribe: vi.fn(), broadcastUpdate: vi.fn() },
}))

// The session revocation listener checks session validity on mount; stub it
// so the router tests don't make a real RPC call.
vi.mock('@/shared/api/supabase-session', () => ({
  getActiveSessions: vi.fn(() => Promise.resolve([])),
  revokeSession: vi.fn(() => Promise.resolve(true)),
  revokeOtherSessions: vi.fn(() => Promise.resolve(0)),
  isSessionValid: vi.fn(() => Promise.resolve(true)),
}))

// The entry detail route uses useEntryStatus which depends on useEntries;
// stub it so the dashboard route renders field cards in tests.
vi.mock('@/features/fields/model/use-entry-status', () => ({
  useEntryStatus: () => 'valid',
}))

function renderWithRouter(authOverrides: Partial<AuthContext> = {}, initialPath = '/') {
  const auth: AuthContext = {
    isAuthenticated: false,
    user: null,
    isLoading: false,
    isRestoringSession: false,
    adapter: authAdapter,
    ...authOverrides,
  }

  const memoryHistory = createMemoryHistory({
    initialEntries: [initialPath],
  })

  const router = createRouter({
    routeTree,
    history: memoryHistory,
    context: { auth },
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  })

  return {
    router,
    ...render(<RouterProvider router={router} />),
  }
}

describe('Router redirects', () => {
  it('does not redirect / to /login when not authenticated', async () => {
    const { router } = renderWithRouter({}, '/')
    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe('/login')
      expect(router.state.location.pathname).toBe('/')
    })
  })

  it('redirects /dashboard to /login when not authenticated', async () => {
    const { router } = renderWithRouter({}, '/dashboard')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
  })

  it('redirects /settings to /login when not authenticated', async () => {
    const { router } = renderWithRouter({}, '/settings')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
  })

  it('redirects / to /dashboard when authenticated', async () => {
    const { router } = renderWithRouter({ isAuthenticated: true, user: { id: '1', username: 'test' } }, '/')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard')
    })
  })

  it('redirects /login to /dashboard when authenticated', async () => {
    const { router } = renderWithRouter({ isAuthenticated: true, user: { id: '1', username: 'test' } }, '/login')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard')
    })
  })
})

describe('Router page rendering', () => {
  it('renders login page with username input at /login', async () => {
    renderWithRouter({}, '/login')
    await waitFor(
      () => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it('renders register page at /register', async () => {
    renderWithRouter({}, '/register')
    await waitFor(() => {
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    })
  })

  it('renders recover page at /recover', async () => {
    renderWithRouter({}, '/recover')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recover/i })).toBeInTheDocument()
    })
  })

  it('renders dashboard with field cards when authenticated', async () => {
    useAuthStore.setState({ user: { id: '1', username: 'test', createdAt: '2024-01-01T00:00:00Z' } })
    renderWithRouter({ isAuthenticated: true, user: { id: '1', username: 'test' } }, '/dashboard/test-entry')
    await waitFor(() => {
      expect(screen.getByText('Note')).toBeInTheDocument()
      expect(screen.getByText('Website')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
    })
  })

  it('renders settings page when authenticated', async () => {
    useAuthStore.setState({ user: { id: '1', username: 'test', createdAt: '2024-01-01T00:00:00Z' } })
    renderWithRouter({ isAuthenticated: true, user: { id: '1', username: 'test' } }, '/settings')
    await waitFor(() => {
      expect(screen.getAllByText(/account/i).length).toBeGreaterThan(0)
    })
  })
})
