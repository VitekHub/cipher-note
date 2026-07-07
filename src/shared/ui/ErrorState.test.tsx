import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { ErrorState } from '@/shared/ui/ErrorState'

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

describe('ErrorState', () => {
  it('renders a raw-string title', () => {
    render(<ErrorState title="Something broke" />)
    expect(screen.getByText('Something broke')).toBeInTheDocument()
  })

  it('resolves an i18n key title', () => {
    render(<ErrorState title="common:status.error" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders the description when provided', () => {
    render(<ErrorState title="common:status.error" description="entries:errors.loadFailed" />)
    expect(screen.getByText("Couldn't load your notes.")).toBeInTheDocument()
  })

  it('always shows a Go home button', () => {
    render(<ErrorState title="common:status.error" />)
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
  })

  it('shows retry and Go home when onRetry is provided', () => {
    const onRetry = vi.fn()
    render(<ErrorState title="common:status.error" onRetry={onRetry} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
  })

  it('shows Go home as outline when retry is available', () => {
    const onRetry = vi.fn()
    render(<ErrorState title="common:status.error" onRetry={onRetry} />)
    const goHomeButton = screen.getByRole('button', { name: 'Go home' })
    expect(goHomeButton).toHaveClass('border-border')
  })

  it('calls onRetry when the retry button is clicked', async () => {
    const onRetry = vi.fn()
    render(<ErrorState title="common:status.error" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('navigates home when the Go home button is clicked', async () => {
    render(<ErrorState title="common:status.error" />)
    await userEvent.click(screen.getByRole('button', { name: 'Go home' }))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
  })
})
