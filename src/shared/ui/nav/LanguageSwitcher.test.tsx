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
    expect(screen.getByRole('button', { name: 'Čeština' })).toBeInTheDocument()
  })

  it('defaults to compact variant', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument()
  })

  it('switches language when clicked in compact variant', async () => {
    const user = userEvent.setup()
    render(<LanguageSwitcher variant="compact" />)
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(i18next.language.startsWith('cs')).toBe(true)
  })

  it('switches language when clicked in full variant', async () => {
    const user = userEvent.setup()
    render(<LanguageSwitcher variant="full" />)
    await user.click(screen.getByRole('button', { name: 'Čeština' }))
    expect(i18next.language.startsWith('cs')).toBe(true)
  })

  it('marks active language with aria-pressed in full variant', () => {
    render(<LanguageSwitcher variant="full" />)
    const enButton = screen.getByRole('button', { name: 'English' })
    const csButton = screen.getByRole('button', { name: 'Čeština' })
    expect(enButton).toHaveAttribute('aria-pressed', 'true')
    expect(csButton).toHaveAttribute('aria-pressed', 'false')
  })
})
