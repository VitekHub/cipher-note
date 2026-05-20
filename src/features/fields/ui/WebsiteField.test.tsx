import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'

import { WebsiteField } from './WebsiteField'

describe('WebsiteField', () => {
  it('renders an input with type url', () => {
    render(<WebsiteField />)
    const input = screen.getByPlaceholderText('Enter website URL')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'url')
  })

  it('has autocomplete url attribute', () => {
    render(<WebsiteField />)
    const input = screen.getByPlaceholderText('Enter website URL')
    expect(input).toHaveAttribute('autocomplete', 'url')
  })
})
