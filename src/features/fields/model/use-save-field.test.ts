import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

// --- Hoisted mocks ---

const { mockSaveField } = vi.hoisted(() => ({
  mockSaveField: vi.fn<(fieldName: string, plaintext: string) => Promise<void>>(),
}))

vi.mock('@/features/fields/model/field-service', () => ({
  fieldService: { saveField: mockSaveField },
}))

// --- Import after mocks ---

import { useSaveField } from '@/features/fields/model/use-save-field'

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
})

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: testQueryClient }, children)
}

afterEach(() => {
  testQueryClient.clear()
})

describe('useSaveField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveField.mockResolvedValue(undefined)
  })

  it('calls fieldService.saveField with the field name and plaintext on mutate', async () => {
    const { result } = renderHook(() => useSaveField('note'), { wrapper })

    result.current.mutate('My note content')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(mockSaveField).toHaveBeenCalledWith('note', 'My note content')
  })

  it('invalidates the field query on success', async () => {
    const invalidateSpy = vi.spyOn(testQueryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSaveField('note'), { wrapper })

    result.current.mutate('My note content')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['field', 'note'] })
  })

  it('sets error state when saveField throws', async () => {
    mockSaveField.mockRejectedValue(new Error('Save failed'))

    const { result } = renderHook(() => useSaveField('note'), { wrapper })

    result.current.mutate('test')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Save failed')
  })
})
