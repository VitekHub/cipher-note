import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import commonEn from '@/shared/i18n/locales/en/common.json'
import authEn from '@/shared/i18n/locales/en/auth.json'
import fieldsEn from '@/shared/i18n/locales/en/fields.json'
import settingsEn from '@/shared/i18n/locales/en/settings.json'
import cryptoEn from '@/shared/i18n/locales/en/crypto.json'
import commonCs from '@/shared/i18n/locales/cs/common.json'
import authCs from '@/shared/i18n/locales/cs/auth.json'
import fieldsCs from '@/shared/i18n/locales/cs/fields.json'
import settingsCs from '@/shared/i18n/locales/cs/settings.json'
import cryptoCs from '@/shared/i18n/locales/cs/crypto.json'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { useUiStore } from '@/features/settings/model/ui-store'

afterEach(() => {
  cleanup()
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: false,
    isRestoringSession: false,
  })
  useCryptoStore.setState({
    masterKey: null,
    kek: null,
    fieldKeys: {},
    isVaultLocked: true,
    lastActivity: 0,
  })
  useUiStore.setState({
    sidebarOpen: true,
    activeField: null,
  })
})

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: {
      en: { common: commonEn, auth: authEn, fields: fieldsEn, settings: settingsEn, crypto: cryptoEn },
      cs: { common: commonCs, auth: authCs, fields: fieldsCs, settings: settingsCs, crypto: cryptoCs },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'cs'],
    ns: ['common', 'auth', 'fields', 'settings', 'crypto'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    lng: 'en',
  })
})

const matchMediaMock = (query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  onchange: null,
  dispatchEvent: vi.fn(),
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(matchMediaMock),
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver

HTMLElement.prototype.scrollIntoView = vi.fn()
