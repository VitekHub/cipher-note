import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'

import { PreferencesSection } from './PreferencesSection'

describe('PreferencesSection', () => {
  it('renders section title and description', () => {
    render(<PreferencesSection />)
    expect(screen.getByText('Preferences')).toBeInTheDocument()
    expect(screen.getByText('Language and display preferences.')).toBeInTheDocument()
  })

  it('renders language label', () => {
    render(<PreferencesSection />)
    expect(screen.getByText('Language')).toBeInTheDocument()
  })

  it('renders language switcher buttons', () => {
    render(<PreferencesSection />)
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Czech' })).toBeInTheDocument()
  })
})
