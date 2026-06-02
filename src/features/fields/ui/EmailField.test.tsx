import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { EmailField } from './EmailField'

describe('EmailField', () => {
  it('renders an input with type email', () => {
    render(<EmailField value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Enter email address')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'email')
  })

  it('has autocomplete email attribute', () => {
    render(<EmailField value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Enter email address')
    expect(input).toHaveAttribute('autocomplete', 'email')
  })

  it('reflects the value prop as a controlled input', () => {
    render(<EmailField value="test@example.com" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Enter email address')
    expect(input).toHaveValue('test@example.com')
  })

  it('calls onChange when user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<EmailField value="" onChange={onChange} />)
    const input = screen.getByPlaceholderText('Enter email address')
    await user.type(input, 'hello')
    expect(onChange).toHaveBeenCalled()
  })
})
