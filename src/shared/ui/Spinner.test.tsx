import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { Spinner } from '@/shared/ui/Spinner'

describe('Spinner', () => {
  it('renders with default size (md)', () => {
    const { container } = render(<Spinner />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('class')).toContain('size-4')
    expect(svg?.getAttribute('class')).toContain('animate-spin')
  })

  it('renders small size', () => {
    const { container } = render(<Spinner size="sm" />)
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('size-3')
  })

  it('renders large size', () => {
    const { container } = render(<Spinner size="lg" />)
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('size-6')
  })

  it('applies custom className to the SVG', () => {
    const { container } = render(<Spinner className="text-muted-foreground" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('text-muted-foreground')
  })

  it('has status role and screen reader label for accessibility', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('hides the SVG from assistive technology', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
