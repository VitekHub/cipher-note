import { describe, it, expect, beforeAll } from 'vitest'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'

function createTestI18n() {
  return i18n
    .createInstance()
    .use(initReactI18next)
    .use(resourcesToBackend((language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`)))
}

const initOptions = {
  fallbackLng: 'en',
  supportedLngs: ['en', 'cs'],
  ns: ['common', 'auth', 'fields', 'settings', 'crypto'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
} as const

describe('i18n configuration', () => {
  let testI18n: typeof i18n

  beforeAll(async () => {
    testI18n = createTestI18n()
    await testI18n.init(initOptions)
  })

  it('defaults to English', () => {
    expect(testI18n.language).toBe('en')
  })

  it('translates English common strings', () => {
    expect(testI18n.t('app.name')).toBe('Cipher Note')
    expect(testI18n.t('app.tagline')).toBe('Your notes. Your privacy. Your control.')
  })

  it('switches to Czech and translates strings', async () => {
    await testI18n.changeLanguage('cs')
    expect(testI18n.language).toBe('cs')
    expect(testI18n.t('app.name')).toBe('Cipher Note')
    expect(testI18n.t('app.tagline')).toBe('Vaše poznámky. Vaše soukromí. Vaše kontrola.')
  })

  it('loads crypto namespace in Czech', async () => {
    const csI18n = createTestI18n()
    await csI18n.init({ ...initOptions, lng: 'cs' })
    await csI18n.loadNamespaces(['crypto'])
    expect(csI18n.t('vault.locked', { ns: 'crypto' })).toBe('Trezor uzamčen')
  })

  it('loads auth namespace on demand', async () => {
    const enI18n = createTestI18n()
    await enI18n.init(initOptions)
    await enI18n.loadNamespaces(['auth'])
    expect(enI18n.t('auth:login.title')).toBe('Log In')
  })

  it('loads Czech auth namespace', async () => {
    const csI18n = createTestI18n()
    await csI18n.init({ ...initOptions, lng: 'cs' })
    await csI18n.loadNamespaces(['auth'])
    expect(csI18n.t('auth:login.title')).toBe('Přihlášení')
  })
})
