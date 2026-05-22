import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { UsernameAvailability } from '@/features/auth/ui/UsernameAvailability'

describe('UsernameAvailability', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<UsernameAvailability status="idle" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders spinner and checking text when status is checking', () => {
    render(<UsernameAvailability status="checking" />)
    expect(screen.getByText(/checking availability/i)).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders check icon and available text when status is available', () => {
    render(<UsernameAvailability status="available" />)
    expect(screen.getByText(/username is available/i)).toBeInTheDocument()
  })

  it('renders X icon and taken text when status is taken', () => {
    render(<UsernameAvailability status="taken" />)
    expect(screen.getByText(/username is already taken/i)).toBeInTheDocument()
  })

  it('renders error text when status is error', () => {
    render(<UsernameAvailability status="error" />)
    expect(screen.getByText(/could not check availability/i)).toBeInTheDocument()
  })
})
