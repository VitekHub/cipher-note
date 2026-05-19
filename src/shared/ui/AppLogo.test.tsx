import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { AppLogo } from './AppLogo'

describe('AppLogo', () => {
  it('renders app name', () => {
    render(<AppLogo />)
    expect(screen.getByText('Cipher Note')).toBeInTheDocument()
  })

  it('renders zap icon', () => {
    const { container } = render(<AppLogo />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<AppLogo className="mt-4" />)
    expect(container.firstChild).toHaveClass('mt-4')
  })
})
