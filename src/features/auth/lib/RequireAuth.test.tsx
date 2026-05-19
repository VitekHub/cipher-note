import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { RequireAuth } from './RequireAuth'
import { useAuthStore } from '@/features/auth/model/auth-store'

vi.mock('@tanstack/react-router', () => ({
  Navigate: ({ to, search }: { to: string; search?: object }) => (
    <div data-testid="navigate" data-to={to} data-search={JSON.stringify(search)} />
  ),
  useLocation: () => ({ href: '/protected' }),
}))

vi.mock('@/shared/api/supabase-client', () => ({
  getSupabase: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}))

describe('RequireAuth', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isInitializing: false,
    })
  })

  it('renders children when authenticated', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'testuser', createdAt: '2024-01-01' },
      session: { accessToken: 'tok', expiresAt: 0 },
    })

    render(
      <RequireAuth>
        <div data-testid="protected-content">Protected Content</div>
      </RequireAuth>,
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    render(
      <RequireAuth>
        <div data-testid="protected-content">Protected Content</div>
      </RequireAuth>,
    )

    expect(screen.getByTestId('navigate')).toBeInTheDocument()
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login')
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('shows loading skeleton when isInitializing is true', () => {
    useAuthStore.setState({ isInitializing: true })

    render(
      <RequireAuth>
        <div data-testid="protected-content">Protected Content</div>
      </RequireAuth>,
    )

    // PageSkeleton renders Skeleton components, not the content or navigate
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })
})
