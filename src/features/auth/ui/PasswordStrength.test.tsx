import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { useRef } from 'react'
import { PasswordStrength } from './PasswordStrength'

function TestWrapper({ password }: { password: string }) {
  const anchorRef = useRef<HTMLDivElement>(null)
  return (
    <>
      <div ref={anchorRef} data-testid="anchor" />
      <PasswordStrength password={password} anchorRef={anchorRef} />
    </>
  )
}

describe('PasswordStrength', () => {
  it('renders nothing visible for empty password', () => {
    render(<TestWrapper password="" />)
    expect(screen.queryByText('Weak')).not.toBeInTheDocument()
  })

  it('shows "Weak" for short password meeting 0-1 criteria', () => {
    render(<TestWrapper password="a" />)
    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('shows "Weak" for short diverse password regardless of other criteria', () => {
    render(<TestWrapper password="aA1" />)
    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('shows "Weak" for 8 char password meeting 1 criteria', () => {
    render(<TestWrapper password="password" />)
    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('shows "Fair" for 12+ char password meeting 2 criteria', () => {
    render(<TestWrapper password="biggerpassword" />)
    expect(screen.getByText('Fair')).toBeInTheDocument()
  })

  it('shows "Strong" for 8+ char password meeting 3 criteria', () => {
    render(<TestWrapper password="Password1!" />)
    expect(screen.getByText('Strong')).toBeInTheDocument()
  })

  it('renders 4 criteria', () => {
    render(<TestWrapper password="a" />)
    expect(screen.getByText('At least 12 characters')).toBeInTheDocument()
    expect(screen.getByText('Contains uppercase letter')).toBeInTheDocument()
    expect(screen.getByText('Contains lowercase letter')).toBeInTheDocument()
    expect(screen.getByText('Contains digit or special character')).toBeInTheDocument()
    expect(screen.getByText('Recommended:')).toBeInTheDocument()
  })

  it('renders 4 bar segments', () => {
    render(<TestWrapper password="a" />)
    const bars = document.querySelectorAll('[data-testid="strength-bar"]')
    expect(bars.length).toBe(4)
  })
})
