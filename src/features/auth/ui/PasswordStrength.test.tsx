import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { PasswordStrength } from './PasswordStrength'

describe('PasswordStrength', () => {
  it('shows "Weak" for empty password', () => {
    render(<PasswordStrength password="" />)
    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('shows "Weak" for password meeting 0–1 criteria', () => {
    render(<PasswordStrength password="a" />)
    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('shows "Fair" for password meeting 2–3 criteria', () => {
    // "password" meets: minLength (8+), lowercase → score 2 → Fair
    render(<PasswordStrength password="password" />)
    expect(screen.getByText('Fair')).toBeInTheDocument()
  })

  it('shows "Strong" for password meeting 4–5 criteria', () => {
    // "Password1!" meets: minLength, uppercase, lowercase, digitOrSpecial → score 4 → Strong
    render(<PasswordStrength password="Password1!" />)
    expect(screen.getByText('Strong')).toBeInTheDocument()
  })

  it('renders all 5 criteria', () => {
    render(<PasswordStrength password="" />)
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('At least 12 characters')).toBeInTheDocument()
    expect(screen.getByText('Contains uppercase letter')).toBeInTheDocument()
    expect(screen.getByText('Contains lowercase letter')).toBeInTheDocument()
    expect(screen.getByText('Contains digit or special character')).toBeInTheDocument()
  })

  it('renders 5 bar segments', () => {
    const { container } = render(<PasswordStrength password="" />)
    const bars = container.querySelectorAll('.flex.gap-1 > div')
    expect(bars.length).toBe(5)
  })
})
