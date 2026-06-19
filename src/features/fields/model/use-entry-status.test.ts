import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

import { useEntryStatus } from '@/features/fields/model/use-entry-status'
import { ENTRY_STATUS } from '@/features/fields/model/entry-status'

// --- Hoisted mocks ---

const mockUseEntries = vi.fn()

vi.mock('@/features/fields/model/use-entry', () => ({
  useEntries: () => mockUseEntries(),
}))

// --- Import after mocks ---

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = createQueryClient()
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useEntryStatus', () => {
  it('returns LOADING when entries query is still loading', () => {
    mockUseEntries.mockReturnValue({ data: undefined, isLoading: true })
    const { result } = renderHook(() => useEntryStatus('entry-1'), { wrapper })
    expect(result.current).toBe(ENTRY_STATUS.LOADING)
  })

  it('returns NOT_FOUND when entries loaded but entryId is not in list', async () => {
    mockUseEntries.mockReturnValue({ data: [{ id: 'other-entry' }], isLoading: false })
    const { result } = renderHook(() => useEntryStatus('missing-entry'), { wrapper })
    await waitFor(() => {
      expect(result.current).toBe(ENTRY_STATUS.NOT_FOUND)
    })
  })

  it('returns VALID when entries loaded and entryId is in list', async () => {
    mockUseEntries.mockReturnValue({ data: [{ id: 'entry-1' }, { id: 'entry-2' }], isLoading: false })
    const { result } = renderHook(() => useEntryStatus('entry-1'), { wrapper })
    await waitFor(() => {
      expect(result.current).toBe(ENTRY_STATUS.VALID)
    })
  })

  it('transitions from VALID to DELETED when entry disappears from list', async () => {
    mockUseEntries.mockReturnValue({ data: [{ id: 'entry-1' }], isLoading: false })
    const { result, rerender } = renderHook(() => useEntryStatus('entry-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toBe(ENTRY_STATUS.VALID)
    })

    // Entry is removed (e.g. deleted on another device)
    mockUseEntries.mockReturnValue({ data: [], isLoading: false })
    rerender()

    await waitFor(() => {
      expect(result.current).toBe(ENTRY_STATUS.DELETED)
    })
  })

  it('stays NOT_FOUND even after refetch if entryId was never in list', async () => {
    mockUseEntries.mockReturnValue({ data: [], isLoading: false })
    const { result } = renderHook(() => useEntryStatus('never-seen'), { wrapper })

    await waitFor(() => {
      expect(result.current).toBe(ENTRY_STATUS.NOT_FOUND)
    })

    // Refetch still doesn't have it
    mockUseEntries.mockReturnValue({ data: [{ id: 'other-entry' }], isLoading: false })
    const { result: result2 } = renderHook(() => useEntryStatus('never-seen'), { wrapper })

    await waitFor(() => {
      expect(result2.current).toBe(ENTRY_STATUS.NOT_FOUND)
    })
  })

  it('transitions from NOT_FOUND to VALID to DELETED when entry appears then disappears', async () => {
    // First: entry not present
    mockUseEntries.mockReturnValue({ data: [], isLoading: false })
    const { result, rerender } = renderHook(() => useEntryStatus('entry-1'), { wrapper })

    await waitFor(() => {
      expect(result.current).toBe(ENTRY_STATUS.NOT_FOUND)
    })

    // Entry appears (e.g. created on another device and synced)
    mockUseEntries.mockReturnValue({ data: [{ id: 'entry-1' }], isLoading: false })
    rerender()

    await waitFor(() => {
      expect(result.current).toBe(ENTRY_STATUS.VALID)
    })

    // Entry disappears again → now DELETED (was seen as valid)
    mockUseEntries.mockReturnValue({ data: [], isLoading: false })
    rerender()

    await waitFor(() => {
      expect(result.current).toBe(ENTRY_STATUS.DELETED)
    })
  })
})
