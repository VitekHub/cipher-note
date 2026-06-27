import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'
import { queryKeys } from '@/shared/lib/query-keys'
import { useCryptoStore, hasCachedEnvelope, setQueryClient } from './crypto-store'

const mockRemoveQueries = vi.fn()
const mockQueryClient = { removeQueries: mockRemoveQueries } as unknown as import('@tanstack/react-query').QueryClient

setQueryClient(mockQueryClient)

const sampleEnvelope: CachedVaultEnvelope = {
  authHashSalt: 'salt1',
  passwordKeySalt: 'salt2',
  wrappedMasterKey: 'wrapped',
  masterKeyIV: 'iv',
  fieldKeys: [
    { fieldName: 'note', version: 1, wrappedFieldKey: 'aa', fieldKeyIV: 'bb' },
    { fieldName: 'website', version: 1, wrappedFieldKey: 'cc', fieldKeyIV: 'dd' },
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

  it('markKeysLoaded loads field keys and unlocks vault', () => {
    useCryptoStore.getState().markKeysLoaded(['title', 'note', 'website', 'email'])

    const state = useCryptoStore.getState()
    expect(state.loadedFieldKeys).toEqual({
      title: true,
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
    useCryptoStore.getState().markKeysLoaded(['note'])
    useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)

    useCryptoStore.getState().lockVault()

    const state = useCryptoStore.getState()
    expect(state.loadedFieldKeys).toEqual({})
    expect(state.isVaultLocked).toBe(true)
    expect(state.lastActivity).toBe(0)
    expect(state.cachedEnvelope).toEqual(sampleEnvelope)
  })

  it('clearVault zeros everything including envelope cache', () => {
    useCryptoStore.getState().markKeysLoaded(['note'])
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

  it('lockVault purges vault query cache', () => {
    useCryptoStore.getState().lockVault()
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: queryKeys.field.all })
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: queryKeys.entry.all })
  })

  it('clearVault purges vault query cache', () => {
    useCryptoStore.getState().clearVault()
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: queryKeys.field.all })
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: queryKeys.entry.all })
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

  it('integration: markKeysLoaded → clearVault zeroes all keys and purges query cache', () => {
    useCryptoStore.getState().markKeysLoaded(['note'])
    useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)

    expect(useCryptoStore.getState().loadedFieldKeys['note']).toBe(true)
    expect(useCryptoStore.getState().isVaultLocked).toBe(false)

    useCryptoStore.getState().clearVault()

    expect(useCryptoStore.getState().loadedFieldKeys).toEqual({})
    expect(useCryptoStore.getState().isVaultLocked).toBe(true)
    expect(useCryptoStore.getState().cachedEnvelope).toBeNull()
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: queryKeys.field.all })
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: queryKeys.entry.all })
  })

  it('never persists keys to localStorage or sessionStorage', () => {
    useCryptoStore.getState().markKeysLoaded(['note'])

    const localStorageKeys = Object.keys(localStorage)
    const sessionStorageKeys = Object.keys(sessionStorage)
    expect(localStorageKeys.every((k) => !k.includes('crypto') && !k.includes('auth'))).toBe(true)
    expect(sessionStorageKeys).toEqual([])

    useCryptoStore.getState().clearVault()
  })
})
