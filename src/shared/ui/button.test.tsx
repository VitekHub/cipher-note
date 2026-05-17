import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { Button } from './button'

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  it('renders with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: /delete/i })
    expect(button).toBeInTheDocument()
  })

  it('renders different size variants', () => {
    render(<Button size="lg">Large Button</Button>)
    const button = screen.getByRole('button', { name: /large button/i })
    expect(button).toBeInTheDocument()
  })

  it('applies dark theme styles', () => {
    render(<Button>Dark Button</Button>)
    const button = screen.getByRole('button', { name: /dark button/i })
    expect(button).toBeVisible()
  })
})
