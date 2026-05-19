import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCryptoStore, selectFieldKey, setQueryClient } from './crypto-store'

const mockRemoveQueries = vi.fn()
const mockQueryClient = { removeQueries: mockRemoveQueries } as unknown as import('@tanstack/react-query').QueryClient

setQueryClient(mockQueryClient)

describe('crypto-store', () => {
  beforeEach(() => {
    mockRemoveQueries.mockClear()
    useCryptoStore.getState().lockVault()
  })

  it('initializes with locked vault and empty keys', () => {
    const state = useCryptoStore.getState()
    expect(state.masterKey).toBeNull()
    expect(state.kek).toBeNull()
    expect(state.fieldKeys).toEqual({})
    expect(state.isVaultLocked).toBe(true)
    expect(state.lastActivity).toBe(0)
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

  it('lockVault zeros all keys and sets isVaultLocked to true', () => {
    useCryptoStore.getState().setKeys('mk', 'kk', {
      note: 'notekey',
      website: 'webkey',
    })

    useCryptoStore.getState().lockVault()

    const state = useCryptoStore.getState()
    expect(state.masterKey).toBeNull()
    expect(state.kek).toBeNull()
    expect(state.fieldKeys).toEqual({})
    expect(state.isVaultLocked).toBe(true)
  })

  it('selectFieldKey returns null after lockVault', () => {
    useCryptoStore.getState().setKeys('mk', 'kk', {
      note: 'notekey',
    })
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
})
