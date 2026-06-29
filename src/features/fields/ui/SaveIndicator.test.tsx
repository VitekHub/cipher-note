import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { SaveIndicator } from './SaveIndicator'

describe('SaveIndicator', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<SaveIndicator status="idle" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when status is dirty', () => {
    const { container } = render(<SaveIndicator status="dirty" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows spinner and "Saving..." when status is saving', () => {
    render(<SaveIndicator status="saving" />)
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    // The Loader2 icon is present (spinning)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows check icon and "Saved" when status is saved', () => {
    render(<SaveIndicator status="saved" />)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('shows error icon, "Save failed" and retry button when status is error', () => {
    const onRetry = vi.fn()
    render(<SaveIndicator status="error" onRetry={onRetry} />)
    expect(screen.getByText('Save failed')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('does not render retry button when onRetry is not provided', () => {
    render(<SaveIndicator status="error" />)
    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<SaveIndicator status="error" onRetry={onRetry} />)
    await user.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renders with custom className', () => {
    render(<SaveIndicator status="saving" className="ml-2" />)
    const element = screen.getByText('Saving...').closest('span')
    expect(element?.className).toContain('ml-2')
  })
})
