import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'
import { useCryptoStore, hasCachedEnvelope, setQueryClient } from './crypto-store'

const mockRemoveQueries = vi.fn()
const mockQueryClient = { removeQueries: mockRemoveQueries } as unknown as import('@tanstack/react-query').QueryClient

setQueryClient(mockQueryClient)

const sampleEnvelope: CachedVaultEnvelope = {
  authSalt: 'salt1',
  keySalt: 'salt2',
  wrappedMasterKey: 'wrapped',
  masterKeyIV: 'iv',
  fieldKeys: [
    { fieldName: 'note', version: 1, wrappedKey: 'aa', keyIV: 'bb' },
    { fieldName: 'website', version: 1, wrappedKey: 'cc', keyIV: 'dd' },
  ],
}

describe('crypto-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRemoveQueries.mockClear()
    useCryptoStore.getState().clearVault()
  })

  it('initializes with locked vault and empty loadedFieldKeys', () => {
    const state = useCryptoStore.getState()
    expect(state.loadedFieldKeys).toEqual({})
    expect(state.isVaultLocked).toBe(true)
    expect(state.lastActivity).toBe(0)
  })

  it('initializes with null cached envelope', () => {
    const state = useCryptoStore.getState()
    expect(state.cachedEnvelope).toBeNull()
  })

  it('setKeys loads field keys and unlocks vault', () => {
    useCryptoStore.getState().setKeys(['note', 'website', 'email'])

    const state = useCryptoStore.getState()
    expect(state.loadedFieldKeys).toEqual({
      note: true,
      website: true,
      email: true,
    })
    expect(state.isVaultLocked).toBe(false)
    expect(state.lastActivity).toBeGreaterThan(0)
  })

  it('setCachedEnvelope stores the envelope object', () => {
    useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)

    const state = useCryptoStore.getState()
    expect(state.cachedEnvelope).toEqual(sampleEnvelope)
  })

  it('lockVault zeros keys but preserves envelope cache', () => {
    useCryptoStore.getState().setKeys(['note'])
    useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)

    useCryptoStore.getState().lockVault()

    const state = useCryptoStore.getState()
    expect(state.loadedFieldKeys).toEqual({})
    expect(state.isVaultLocked).toBe(true)
    expect(state.lastActivity).toBe(0)
    expect(state.cachedEnvelope).toEqual(sampleEnvelope)
  })

  it('clearVault zeros everything including envelope cache', () => {
    useCryptoStore.getState().setKeys(['note'])
    useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)

    useCryptoStore.getState().clearVault()

    const state = useCryptoStore.getState()
    expect(state.loadedFieldKeys).toEqual({})
    expect(state.isVaultLocked).toBe(true)
    expect(state.lastActivity).toBe(0)
    expect(state.cachedEnvelope).toBeNull()
  })

  it('updateActivity updates lastActivity timestamp', () => {
    useCryptoStore.getState().updateActivity()
    const time1 = useCryptoStore.getState().lastActivity

    expect(time1).toBeGreaterThan(0)
  })

  it('lockVault purges field query cache', () => {
    useCryptoStore.getState().lockVault()
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: ['field'] })
  })

  it('clearVault purges field query cache', () => {
    useCryptoStore.getState().clearVault()
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: ['field'] })
  })

  describe('hasCachedEnvelope', () => {
    it('returns false when cachedEnvelope is null', () => {
      expect(hasCachedEnvelope(useCryptoStore.getState())).toBe(false)
    })

    it('returns true when cachedEnvelope is set', () => {
      useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)
      expect(hasCachedEnvelope(useCryptoStore.getState())).toBe(true)
    })

    it('returns true after lockVault preserves envelope', () => {
      useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)
      useCryptoStore.getState().lockVault()
      expect(hasCachedEnvelope(useCryptoStore.getState())).toBe(true)
    })

    it('returns false after clearVault', () => {
      useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)
      useCryptoStore.getState().clearVault()
      expect(hasCachedEnvelope(useCryptoStore.getState())).toBe(false)
    })
  })

  it('integration: setKeys → clearVault zeroes all keys and purges query cache', () => {
    useCryptoStore.getState().setKeys(['note'])
    useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)

    expect(useCryptoStore.getState().loadedFieldKeys['note']).toBe(true)
    expect(useCryptoStore.getState().isVaultLocked).toBe(false)

    useCryptoStore.getState().clearVault()

    expect(useCryptoStore.getState().loadedFieldKeys).toEqual({})
    expect(useCryptoStore.getState().isVaultLocked).toBe(true)
    expect(useCryptoStore.getState().cachedEnvelope).toBeNull()
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: ['field'] })
  })

  it('never persists keys to localStorage or sessionStorage', () => {
    useCryptoStore.getState().setKeys(['note'])

    const localStorageKeys = Object.keys(localStorage)
    const sessionStorageKeys = Object.keys(sessionStorage)
    expect(localStorageKeys.every((k) => !k.includes('crypto') && !k.includes('auth'))).toBe(true)
    expect(sessionStorageKeys).toEqual([])

    useCryptoStore.getState().clearVault()
  })
})
