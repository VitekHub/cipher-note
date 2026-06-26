import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { createElement, type ReactNode } from 'react'
import { queryKeys } from '@/shared/lib/query-keys'
import type { FieldName } from '@/shared/types/entities/field.types'

// --- Hoisted mocks ---

const { mockSaveField, mockLoadField } = vi.hoisted(() => ({
  mockSaveField:
    vi.fn<(args: { userId: string; entryId: string; fieldName: string; plaintext: string }) => Promise<string>>(),
  mockLoadField: vi.fn<(...args: [string, string]) => Promise<string | null>>(),
}))

const { mockUseRequiredUserId } = vi.hoisted(() => ({
  mockUseRequiredUserId: vi.fn<() => string>(),
}))

vi.mock('@/features/fields/model/field-service', () => ({
  fieldService: {
    saveField: mockSaveField,
    loadField: mockLoadField,
  },
}))

vi.mock('@/shared/auth/use-current-user', () => ({
  useRequiredUserId: mockUseRequiredUserId,
}))

// --- Import after mocks ---

import { useSaveField, useField } from '@/features/fields/model/use-field'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = createQueryClient()
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

const TEST_ENTRY_ID = 'entry-123'
const TEST_FIELD_NAME = 'note' as FieldName

describe('useField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCryptoStore.setState({
      loadedFieldKeys: { note: true, website: true, email: true },
      isVaultLocked: false,
      lastActivity: Date.now(),
      cachedEnvelope: null,
    })
    mockLoadField.mockResolvedValue('test content')
  })

  it('fetches and returns decrypted field content when vault is unlocked', async () => {
    mockLoadField.mockResolvedValue('My note content')

    const { result } = renderHook(() => useField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe('My note content')
    expect(mockLoadField).toHaveBeenCalledWith(TEST_ENTRY_ID, TEST_FIELD_NAME)
  })

  it('returns null when field has never been saved', async () => {
    mockLoadField.mockResolvedValue(null)

    const { result } = renderHook(() => useField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })

  it('is disabled when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true, loadedFieldKeys: {} })

    const { result } = renderHook(() => useField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockLoadField).not.toHaveBeenCalled()
  })

  it('is disabled when field key is not loaded', () => {
    useCryptoStore.setState({ loadedFieldKeys: {} })

    const { result } = renderHook(() => useField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockLoadField).not.toHaveBeenCalled()
  })

  it('is enabled when vault is unlocked and field key is loaded', async () => {
    mockLoadField.mockResolvedValue('hello')

    const { result } = renderHook(() => useField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe('hello')
  })

  it('sets error state immediately for DecryptionError (no retry)', async () => {
    const { DecryptionError } = await import('@/shared/crypto/core/errors')
    mockLoadField.mockRejectedValue(new DecryptionError('Decryption failed'))

    const { result } = renderHook(() => useField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(DecryptionError)
    expect(mockLoadField).toHaveBeenCalledTimes(1) // no retry for crypto errors
  })

  it('retries on non-crypto errors before failing', async () => {
    mockLoadField.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })

    // Allow time for retries with backoff (1s + 2s = ~3s total)
    await waitFor(
      () => {
        expect(result.current.isError).toBe(true)
      },
      { timeout: 5000 },
    )
    // retry: (failureCount, error) => failureCount < 2 → 3 total attempts
    expect(mockLoadField).toHaveBeenCalledTimes(3)
  })
})

describe('useSaveField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveField.mockResolvedValue('2026-01-01T00:00:00Z')
    mockUseRequiredUserId.mockReturnValue('user-123')
  })

  it('calls fieldService.saveField with userId, field name and plaintext on mutate', async () => {
    const { result } = renderHook(() => useSaveField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })

    result.current.mutate('My note content')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockSaveField).toHaveBeenCalledWith({
      userId: 'user-123',
      entryId: TEST_ENTRY_ID,
      fieldName: TEST_FIELD_NAME,
      plaintext: 'My note content',
    })
  })

  it('optimistically updates the field query cache on mutate', async () => {
    const queryClient = createQueryClient()
    // Pre-populate cache with existing data
    queryClient.setQueryData(queryKeys.field.detail(TEST_ENTRY_ID, TEST_FIELD_NAME), 'old content')

    const localWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useSaveField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper: localWrapper })

    result.current.mutate('new content')

    // Optimistic update should be visible immediately
    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.field.detail(TEST_ENTRY_ID, TEST_FIELD_NAME))).toBe('new content')
    })
  })

  it('rolls back cache on error', async () => {
    mockSaveField.mockRejectedValue(new Error('Save failed'))

    const queryClient = createQueryClient()
    queryClient.setQueryData(queryKeys.field.detail(TEST_ENTRY_ID, TEST_FIELD_NAME), 'original content')

    const localWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useSaveField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper: localWrapper })

    result.current.mutate('new content')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    // Cache should be rolled back
    expect(queryClient.getQueryData(queryKeys.field.detail(TEST_ENTRY_ID, TEST_FIELD_NAME))).toBe('original content')
  })

  it('invalidates the field query on settled', async () => {
    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const localWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useSaveField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper: localWrapper })

    result.current.mutate('My note content')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.field.detail(TEST_ENTRY_ID, TEST_FIELD_NAME) })
  })

  it('sets error state when saveField throws', async () => {
    mockSaveField.mockRejectedValue(new Error('Save failed'))

    const { result } = renderHook(() => useSaveField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })

    result.current.mutate('test')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Save failed')
  })

  it('throws when user is not authenticated', () => {
    mockUseRequiredUserId.mockImplementation(() => {
      throw new Error('useUserId requires an authenticated user')
    })

    expect(() => renderHook(() => useSaveField(TEST_ENTRY_ID, TEST_FIELD_NAME), { wrapper })).toThrow(
      'useUserId requires an authenticated user',
    )
  })
})
