import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@/test/utils'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useSyncStatusStore } from '@/features/fields/model/sync-status'

import { DashboardPage } from './DashboardPage'

// Mock useAutoSave to avoid needing full TanStack Query + auth setup
vi.mock('@/features/fields/model/auto-save', () => {
  return {
    useAutoSave: (fieldName: string) => ({
      value: `mock-${fieldName}-value`,
      setValue: vi.fn(),
      syncStatus: 'idle' as const,
      retry: vi.fn(),
    }),
  }
})

describe('DashboardPage', () => {
  beforeEach(() => {
    useCryptoStore.setState({
      isVaultLocked: false,
      loadedFieldKeys: { note: true, website: true, email: true },
    })
    useSyncStatusStore.getState().resetAll()
  })

  it('renders all three field cards', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Website')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('shows locked state for all fields when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true, loadedFieldKeys: {} })
    render(<DashboardPage />)
    const lockedMessages = screen.getAllByText('Unlock vault to view')
    expect(lockedMessages).toHaveLength(3)
  })

  it('shows field editors when vault is unlocked', () => {
    render(<DashboardPage />)
    expect(screen.getByPlaceholderText('Write your note...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter website URL')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter email address')).toBeInTheDocument()
  })

  it('renders dashboard heading', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('resets sync status when vault locks', () => {
    useSyncStatusStore.getState().setStatus('note', 'saving')
    useSyncStatusStore.getState().setStatus('website', 'saved')

    render(<DashboardPage />)

    // Lock vault — this triggers the useEffect
    act(() => {
      useCryptoStore.setState({ isVaultLocked: true, loadedFieldKeys: {} })
    })

    // Sync status should be reset by the useEffect
    const { status } = useSyncStatusStore.getState()
    expect(status.note).toBe('idle')
    expect(status.website).toBe('idle')
    expect(status.email).toBe('idle')
  })
})
