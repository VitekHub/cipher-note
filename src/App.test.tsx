import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import App from './App'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'

describe('App', () => {
  beforeAll(async () => {
    await i18n
      .use(initReactI18next)
      .use(
        resourcesToBackend(
          (language: string, namespace: string) => import(`./shared/i18n/locales/${language}/${namespace}.json`),
        ),
      )
      .init({
        fallbackLng: 'en',
        supportedLngs: ['en', 'cs'],
        ns: ['common', 'auth', 'fields', 'settings', 'crypto'],
        defaultNS: 'common',
        interpolation: { escapeValue: false },
      })
  })

  it('renders with dark theme class on html element', () => {
    render(<App />)
    const htmlElement = document.documentElement
    expect(htmlElement.classList.contains('dark')).toBe(true)
  })

  it('renders the Cipher Note heading', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Cipher Note')).toBeInTheDocument()
    })
  })

  it('renders the Log in button', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
    })
  })

  it('renders the language switcher', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument()
    })
  })
})
