import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { InputField } from './InputField'

describe('InputField', () => {
  it('renders an input with type url', () => {
    render(<InputField fieldName="website" value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Enter website URL')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'url')
  })

  it('has autocomplete url attribute', () => {
    render(<InputField fieldName="website" value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Enter website URL')
    expect(input).toHaveAttribute('autocomplete', 'url')
  })

  it('reflects the value prop as a controlled input', () => {
    render(<InputField fieldName="website" value="https://example.com" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Enter website URL')
    expect(input).toHaveValue('https://example.com')
  })

  it('calls onChange when user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<InputField fieldName="website" value="" onChange={onChange} />)
    const input = screen.getByPlaceholderText('Enter website URL')
    await user.type(input, 'hello')
    expect(onChange).toHaveBeenCalled()
  })
})
