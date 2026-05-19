import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from '@/app/routeTree.gen'
import type { AuthContext } from '@/shared/auth/auth-context'

function renderWithRouter(authOverrides: Partial<AuthContext> = {}, initialPath = '/') {
  const auth: AuthContext = {
    isAuthenticated: false,
    user: null,
    isLoading: false,
    isInitializing: false,
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
  it('redirects / to /login when not authenticated', async () => {
    const { router } = renderWithRouter({}, '/')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
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
    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    })
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
    renderWithRouter({ isAuthenticated: true, user: { id: '1', username: 'test' } }, '/dashboard')
    await waitFor(() => {
      expect(screen.getByText('Note')).toBeInTheDocument()
      expect(screen.getByText('Website')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
    })
  })

  it('renders settings page when authenticated', async () => {
    renderWithRouter({ isAuthenticated: true, user: { id: '1', username: 'test' } }, '/settings')
    await waitFor(() => {
      expect(screen.getAllByText(/account/i).length).toBeGreaterThan(0)
    })
  })
})
