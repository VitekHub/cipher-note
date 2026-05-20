import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'

import { NoteField } from './NoteField'

describe('NoteField', () => {
  it('renders a textarea with correct placeholder', () => {
    render(<NoteField />)
    const textarea = screen.getByPlaceholderText('Write your note...')
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('textarea has correct initial rows', () => {
    render(<NoteField />)
    const textarea = screen.getByPlaceholderText('Write your note...')
    expect(textarea).toHaveAttribute('rows', '6')
  })
})
