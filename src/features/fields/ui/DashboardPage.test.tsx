import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { useSyncStatusStore, SYNC_STATUS } from '@/features/fields/model/sync-status-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { LockedVaultCard } from '@/features/vault/ui/LockedVaultCard'

import { EntryDetailPage, EmptyState } from './DashboardPage'

// Mock useFieldEditor to avoid needing full TanStack Query + auth setup
vi.mock('@/features/fields/model/use-field-editor', () => {
  return {
    useFieldEditor: (entryId: string, fieldName: string) => ({
      fieldValue: `mock-${entryId}-${fieldName}-value`,
      saveFieldValue: vi.fn(),
      fieldSyncStatus: SYNC_STATUS.IDLE,
      retrySave: vi.fn(),
      isOfflineAwaitingData: false,
    }),
  }
})

describe('EntryDetailPage', () => {
  beforeEach(() => {
    useCryptoStore.setState({
      isVaultLocked: false,
      loadedFieldKeys: { title: true, note: true, website: true, email: true },
    })
    useSyncStatusStore.getState().resetAll()
    useAuthStore.setState({ user: { id: '1', username: 'testuser', createdAt: '2024-01-01T00:00:00Z' } })
  })

  it('renders all field cards when unlocked', () => {
    render(<EntryDetailPage entryId="test-entry" lockedFallback={<LockedVaultCard />} />)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Website')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('shows locked vault card and hides editors when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true, loadedFieldKeys: {} })
    render(<EntryDetailPage entryId="test-entry" lockedFallback={<LockedVaultCard />} />)

    // LockedVaultCard is rendered
    expect(screen.getByText(/Unlock vault/i)).toBeInTheDocument()

    // Field editors are hidden (aria-hidden=true and class="hidden" on the wrapper)
    const title = screen.getByText('Title')
    const wrapper = title.closest('div[aria-hidden="true"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).toHaveClass('hidden')
  })

  it('shows field editors when vault is unlocked', () => {
    render(<EntryDetailPage entryId="test-entry" lockedFallback={<LockedVaultCard />} />)
    expect(screen.getByPlaceholderText(/Enter title/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Write your note.../i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Enter website URL/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Enter email address/i)).toBeInTheDocument()
  })

  it('resets sync status when entryId changes', () => {
    const { rerender } = render(<EntryDetailPage entryId="entry-1" lockedFallback={<LockedVaultCard />} />)

    useSyncStatusStore.getState().setStatus('entry-1', 'note', SYNC_STATUS.SAVING)
    useSyncStatusStore.getState().setStatus('entry-1', 'website', SYNC_STATUS.SAVED)

    // Change entryId — this triggers the useEffect
    rerender(<EntryDetailPage entryId="entry-2" lockedFallback={<LockedVaultCard />} />)

    const { status } = useSyncStatusStore.getState()
    // resetAll() clears everything, so all entries are gone
    expect(Object.keys(status)).toHaveLength(0)
  })
})

describe('EmptyState', () => {
  const onCreateEntry = vi.fn()

  it('renders empty state content when unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    render(<EmptyState onCreateEntry={onCreateEntry} lockedFallback={<LockedVaultCard />} />)

    expect(screen.getByText(/No notes yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create your first note/i })).toBeInTheDocument()
  })

  it('renders locked vault card when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true })
    render(<EmptyState onCreateEntry={onCreateEntry} lockedFallback={<LockedVaultCard />} />)

    expect(screen.getByText(/Unlock vault/i)).toBeInTheDocument()
    expect(screen.queryByText(/No entries/i)).not.toBeInTheDocument()
  })
})
