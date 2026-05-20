import { describe, it, expect, afterEach } from 'vitest'
import i18next from 'i18next'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'

import { LanguageSwitcher } from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
  afterEach(() => {
    void i18next.changeLanguage('en')
  })

  it('renders compact variant with language code', () => {
    render(<LanguageSwitcher variant="compact" />)
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument()
  })

  it('renders full variant with language names', () => {
    render(<LanguageSwitcher variant="full" />)
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Czech' })).toBeInTheDocument()
  })

  it('defaults to compact variant', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument()
  })

  it('switches language when clicked in compact variant', async () => {
    const user = userEvent.setup()
    render(<LanguageSwitcher variant="compact" />)
    const button = screen.getByRole('button', { name: 'EN' })
    await user.click(button)
  })

  it('switches language when clicked in full variant', async () => {
    const user = userEvent.setup()
    render(<LanguageSwitcher variant="full" />)
    const csButton = screen.getByRole('button', { name: 'Czech' })
    await user.click(csButton)
  })
})
