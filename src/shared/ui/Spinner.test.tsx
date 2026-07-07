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

  it('applies custom className and is marked aria-hidden', () => {
    const { container } = render(<Spinner className="text-muted-foreground" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('text-muted-foreground')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('does not expose an accessible role', () => {
    render(<Spinner />)
    expect(screen.queryByRole('img')).toBeNull()
  })
})
