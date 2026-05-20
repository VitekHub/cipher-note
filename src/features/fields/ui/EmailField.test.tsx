import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'

import { EmailField } from './EmailField'

describe('EmailField', () => {
  it('renders an input with type email', () => {
    render(<EmailField />)
    const input = screen.getByPlaceholderText('Enter email address')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'email')
  })

  it('has autocomplete email attribute', () => {
    render(<EmailField />)
    const input = screen.getByPlaceholderText('Enter email address')
    expect(input).toHaveAttribute('autocomplete', 'email')
  })
})
