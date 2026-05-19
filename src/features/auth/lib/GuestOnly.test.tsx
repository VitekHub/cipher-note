import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { GuestOnly } from './GuestOnly'
import { useAuthStore } from '@/features/auth/model/auth-store'

vi.mock('@tanstack/react-router', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useLocation: () => ({ href: '/guest' }),
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

describe('GuestOnly', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isInitializing: false,
    })
  })

  it('renders children when not authenticated', () => {
    render(
      <GuestOnly>
        <div data-testid="guest-content">Guest Content</div>
      </GuestOnly>,
    )

    expect(screen.getByTestId('guest-content')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('redirects to /dashboard when authenticated', () => {
    useAuthStore.setState({
      user: { id: '1', username: 'testuser', createdAt: '2024-01-01' },
      session: { accessToken: 'tok', expiresAt: 0 },
    })

    render(
      <GuestOnly>
        <div data-testid="guest-content">Guest Content</div>
      </GuestOnly>,
    )

    expect(screen.getByTestId('navigate')).toBeInTheDocument()
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/dashboard')
    expect(screen.queryByTestId('guest-content')).not.toBeInTheDocument()
  })

  it('shows loading skeleton when isInitializing is true', () => {
    useAuthStore.setState({ isInitializing: true })

    render(
      <GuestOnly>
        <div data-testid="guest-content">Guest Content</div>
      </GuestOnly>,
    )

    // PageSkeleton renders Skeleton components, not the content or navigate
    expect(screen.queryByTestId('guest-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })
})
