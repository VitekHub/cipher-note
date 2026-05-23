import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCryptoStore, selectFieldKey, hasCachedEnvelope, setQueryClient } from './crypto-store'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'

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
    mockRemoveQueries.mockClear()
    useCryptoStore.getState().clearVault()
  })

  it('initializes with locked vault and empty keys', () => {
    const state = useCryptoStore.getState()
    expect(state.masterKey).toBeNull()
    expect(state.kek).toBeNull()
    expect(state.fieldKeys).toEqual({})
    expect(state.isVaultLocked).toBe(true)
    expect(state.lastActivity).toBe(0)
  })

  it('initializes with null cached envelope', () => {
    const state = useCryptoStore.getState()
    expect(state.cachedEnvelope).toBeNull()
  })

  it('setKeys stores hex-encoded keys and unlocks vault', () => {
    useCryptoStore.getState().setKeys('a1b2c3', 'd4e5f6', { note: 'aa11bb22', website: 'cc33dd44', email: 'ee55ff66' })

    const state = useCryptoStore.getState()
    expect(state.masterKey).toBe('a1b2c3')
    expect(state.kek).toBe('d4e5f6')
    expect(state.fieldKeys).toEqual({
      note: 'aa11bb22',
      website: 'cc33dd44',
      email: 'ee55ff66',
    })
    expect(state.isVaultLocked).toBe(false)
    expect(state.lastActivity).toBeGreaterThan(0)
  })

  it('setCachedEnvelope stores the envelope object', () => {
    useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)

    const state = useCryptoStore.getState()
    expect(state.cachedEnvelope).toEqual(sampleEnvelope)
  })

  it('selectFieldKey returns correct key by field name', () => {
    useCryptoStore.getState().setKeys('mk', 'kk', {
      note: 'notekey',
      website: 'webkey',
      email: 'emailkey',
    })

    const state = useCryptoStore.getState()
    expect(selectFieldKey('note')(state)).toBe('notekey')
    expect(selectFieldKey('website')(state)).toBe('webkey')
    expect(selectFieldKey('email')(state)).toBe('emailkey')
  })

  it('selectFieldKey returns null for unknown field', () => {
    useCryptoStore.getState().setKeys('mk', 'kk', {
      note: 'notekey',
    })

    expect(selectFieldKey('unknown')(useCryptoStore.getState())).toBeNull()
  })

  it('lockVault zeros keys but preserves envelope cache', () => {
    useCryptoStore.getState().setKeys('mk', 'kk', { note: 'notekey' })
    useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)

    useCryptoStore.getState().lockVault()

    const state = useCryptoStore.getState()
    expect(state.masterKey).toBeNull()
    expect(state.kek).toBeNull()
    expect(state.fieldKeys).toEqual({})
    expect(state.isVaultLocked).toBe(true)
    expect(state.lastActivity).toBe(0)
    // Envelope cache is preserved
    expect(state.cachedEnvelope).toEqual(sampleEnvelope)
  })

  it('clearVault zeros everything including envelope cache', () => {
    useCryptoStore.getState().setKeys('mk', 'kk', { note: 'notekey' })
    useCryptoStore.getState().setCachedEnvelope(sampleEnvelope)

    useCryptoStore.getState().clearVault()

    const state = useCryptoStore.getState()
    expect(state.masterKey).toBeNull()
    expect(state.kek).toBeNull()
    expect(state.fieldKeys).toEqual({})
    expect(state.isVaultLocked).toBe(true)
    expect(state.lastActivity).toBe(0)
    expect(state.cachedEnvelope).toBeNull()
  })

  it('selectFieldKey returns null after lockVault', () => {
    useCryptoStore.getState().setKeys('mk', 'kk', { note: 'notekey' })
    useCryptoStore.getState().lockVault()

    expect(selectFieldKey('note')(useCryptoStore.getState())).toBeNull()
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
})
