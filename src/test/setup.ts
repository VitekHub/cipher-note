import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import commonEn from '@/shared/i18n/locales/en/common.json'
import authEn from '@/shared/i18n/locales/en/auth.json'
import fieldsEn from '@/shared/i18n/locales/en/fields.json'
import settingsEn from '@/shared/i18n/locales/en/settings.json'
import entriesEn from '@/shared/i18n/locales/en/entries.json'
import vaultEn from '@/shared/i18n/locales/en/vault.json'
import commonCs from '@/shared/i18n/locales/cs/common.json'
import authCs from '@/shared/i18n/locales/cs/auth.json'
import fieldsCs from '@/shared/i18n/locales/cs/fields.json'
import settingsCs from '@/shared/i18n/locales/cs/settings.json'
import entriesCs from '@/shared/i18n/locales/cs/entries.json'
import vaultCs from '@/shared/i18n/locales/cs/vault.json'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useLayoutStore } from '@/app/layouts/layout-store'
import { useVaultSettingsStore, DEFAULT_VAULT_TIMEOUT_MS } from '@/shared/stores/vault-settings-store'
import { useSyncStatusStore } from '@/features/fields/model/sync-status-store'

afterEach(() => {
  cleanup()
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: false,
    isRestoringSession: false,
  })
  useCryptoStore.setState({
    loadedFieldKeys: {},
    isVaultLocked: true,
    lastActivity: 0,
  })
  useLayoutStore.setState({
    sidebarOpen: false,
    activeField: null,
    sidebarWidth: 240,
  })
  useVaultSettingsStore.setState({
    vaultTimeoutMs: DEFAULT_VAULT_TIMEOUT_MS,
    lockOnTabHidden: false,
  })
  useSyncStatusStore.getState().resetAll()
})

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: {
      en: {
        common: commonEn,
        auth: authEn,
        fields: fieldsEn,
        settings: settingsEn,
        entries: entriesEn,
        vault: vaultEn,
      },
      cs: {
        common: commonCs,
        auth: authCs,
        fields: fieldsCs,
        settings: settingsCs,
        entries: entriesCs,
        vault: vaultCs,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'cs'],
    ns: ['common', 'auth', 'fields', 'settings', 'entries', 'vault'],
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
