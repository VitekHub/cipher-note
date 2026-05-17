import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import App from './App'

describe('App', () => {
  it('renders with dark theme class on html element', () => {
    render(<App />)
    const htmlElement = document.documentElement
    expect(htmlElement.classList.contains('dark')).toBe(true)
  })

  it('renders the Cipher Note heading', () => {
    render(<App />)
    expect(screen.getByText('Cipher Note')).toBeInTheDocument()
  })

  it('renders the Get Started button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })
})
