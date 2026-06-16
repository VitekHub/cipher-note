import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

// --- Hoisted mocks ---

const { mockSaveField } = vi.hoisted(() => ({
  mockSaveField:
    vi.fn<(args: { userId: string; entryId: string; fieldName: string; plaintext: string }) => Promise<void>>(),
}))

const { mockUseRequiredUserId } = vi.hoisted(() => ({
  mockUseRequiredUserId: vi.fn<() => string>(),
}))

vi.mock('@/features/fields/model/field-service', () => ({
  fieldService: { saveField: mockSaveField },
}))

vi.mock('@/shared/auth/use-current-user', () => ({
  useRequiredUserId: mockUseRequiredUserId,
}))

// --- Import after mocks ---

import { useFieldMutation } from '@/features/fields/model/use-field-mutation'

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

describe('useFieldMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveField.mockResolvedValue(undefined)
    mockUseRequiredUserId.mockReturnValue('user-123')
  })

  it('calls fieldService.saveField with userId, field name and plaintext on mutate', async () => {
    const { result } = renderHook(() => useFieldMutation('entry-123', 'note'), { wrapper })

    result.current.mutate('My note content')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockSaveField).toHaveBeenCalledWith({
      userId: 'user-123',
      entryId: 'entry-123',
      fieldName: 'note',
      plaintext: 'My note content',
    })
  })

  it('optimistically updates the field query cache on mutate', async () => {
    const queryClient = createQueryClient()
    // Pre-populate cache with existing data
    queryClient.setQueryData(['field', 'entry-123', 'note'], 'old content')

    const localWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useFieldMutation('entry-123', 'note'), { wrapper: localWrapper })

    result.current.mutate('new content')

    // Optimistic update should be visible immediately
    await waitFor(() => {
      expect(queryClient.getQueryData(['field', 'entry-123', 'note'])).toBe('new content')
    })
  })

  it('rolls back cache on error', async () => {
    mockSaveField.mockRejectedValue(new Error('Save failed'))

    const queryClient = createQueryClient()
    queryClient.setQueryData(['field', 'entry-123', 'note'], 'original content')

    const localWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useFieldMutation('entry-123', 'note'), { wrapper: localWrapper })

    result.current.mutate('new content')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    // Cache should be rolled back
    expect(queryClient.getQueryData(['field', 'entry-123', 'note'])).toBe('original content')
  })

  it('invalidates the field query on settled', async () => {
    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const localWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useFieldMutation('entry-123', 'note'), { wrapper: localWrapper })

    result.current.mutate('My note content')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['field', 'entry-123', 'note'] })
  })

  it('sets error state when saveField throws', async () => {
    mockSaveField.mockRejectedValue(new Error('Save failed'))

    const { result } = renderHook(() => useFieldMutation('entry-123', 'note'), { wrapper })

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

    expect(() => renderHook(() => useFieldMutation('entry-123', 'note'), { wrapper })).toThrow(
      'useUserId requires an authenticated user',
    )
  })
})
