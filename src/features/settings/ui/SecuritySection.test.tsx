import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'

import { SecuritySection } from './SecuritySection'

describe('SecuritySection', () => {
  it('renders section title and description', () => {
    render(<SecuritySection />)
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Manage your password and security settings.')).toBeInTheDocument()
  })

  it('renders three action items', () => {
    render(<SecuritySection />)
    expect(screen.getByText('Change password')).toBeInTheDocument()
    expect(screen.getByText('View seed phrase')).toBeInTheDocument()
    expect(screen.getByText('Key versions')).toBeInTheDocument()
  })

  it('renders three separator dividers between action items', () => {
    render(<SecuritySection />)
    const separators = screen.getAllByRole('separator')
    expect(separators).toHaveLength(2)
  })
})
