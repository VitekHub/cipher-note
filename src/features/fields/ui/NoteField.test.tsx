import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { NoteField } from './NoteField'

describe('NoteField', () => {
  it('renders a textarea with correct placeholder', () => {
    const onChange = vi.fn()
    render(<NoteField value="" onChange={onChange} />)
    const textarea = screen.getByPlaceholderText('Write your note...')
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('textarea has correct initial rows', () => {
    render(<NoteField value="" onChange={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('Write your note...')
    expect(textarea).toHaveAttribute('rows', '6')
  })

  it('reflects the value prop as a controlled input', () => {
    const onChange = vi.fn()
    render(<NoteField value="Hello world" onChange={onChange} />)
    const textarea = screen.getByPlaceholderText('Write your note...')
    expect(textarea).toHaveValue('Hello world')
  })

  it('calls onChange when user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<NoteField value="" onChange={onChange} />)
    const textarea = screen.getByPlaceholderText('Write your note...')
    await user.type(textarea, 'Hello')
    expect(onChange).toHaveBeenCalled()
  })
})
