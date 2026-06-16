import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/test/utils'
import { useCryptoStore } from '@/shared/crypto/crypto-store'
import { useVaultDialogStore } from '@/shared/crypto/vault-dialog-store'

const { mockLockVault, mockNavigate } = vi.hoisted(() => ({
  mockLockVault: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: vi.fn(() => ({})),
}))

vi.mock('@/shared/crypto/key-vault', () => ({
  keyVault: {
    lockVault: mockLockVault,
  },
}))

vi.mock('@/features/fields/model/use-entry', () => ({
  useEntries: vi.fn(() => ({ data: [] })),
  useCreateEntry: vi.fn(() => vi.fn()),
}))

vi.mock('@/features/fields/model/use-field', () => ({
  useField: vi.fn(() => ({ data: undefined })),
}))

import { useEntries } from '@/features/fields/model/use-entry'
import { useField } from '@/features/fields/model/use-field'
import { MobileNav } from './MobileNav'

type EntriesResult = ReturnType<typeof useEntries>
type FieldResult = ReturnType<typeof useField>

function asEntries(data: { id: string; title?: string }[]): EntriesResult {
  return { data } as unknown as EntriesResult
}

function asField(data: string | null | undefined): FieldResult {
  return { data } as unknown as FieldResult
}

describe('MobileNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useEntries).mockReturnValue(asEntries([]))
    vi.mocked(useField).mockReturnValue(asField(undefined))
  })

  it('renders the create entry button', () => {
    render(<MobileNav />)
    expect(screen.getByRole('button', { name: /new note/i })).toBeInTheDocument()
  })

  it('renders settings nav item', () => {
    render(<MobileNav />)
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('navigates to settings when settings button is clicked', async () => {
    const user = userEvent.setup()
    render(<MobileNav />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/settings' })
  })

  it('renders entry items when entries are present', () => {
    vi.mocked(useEntries).mockReturnValue(
      asEntries([
        { id: 'entry-1', title: 'Secret title for frist entry' },
        { id: 'entry-2', title: 'Secret title for second entry' },
      ]),
    )
    useCryptoStore.setState({ isVaultLocked: true })
    render(<MobileNav />)
    // When locked, it should show "Note 1", "Note 2"
    expect(screen.getByText('Note 1')).toBeInTheDocument()
    expect(screen.getByText('Note 2')).toBeInTheDocument()
  })

  it('renders entry titles when vault is unlocked', () => {
    vi.mocked(useEntries).mockReturnValue(asEntries([{ id: 'entry-1' }]))
    vi.mocked(useField).mockImplementation((_entryId, fieldName) => {
      const data = fieldName === 'title' ? 'My Secret Note' : null
      return asField(data)
    })
    useCryptoStore.setState({ isVaultLocked: false })
    render(<MobileNav />)
    expect(screen.getByText('My Secret Note')).toBeInTheDocument()
  })

  it('navigates to entry when entry item is clicked', async () => {
    vi.mocked(useEntries).mockReturnValue(asEntries([{ id: 'entry-1' }]))
    const user = userEvent.setup()
    render(<MobileNav />)
    await user.click(screen.getByText('Note 1'))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/dashboard/$entryId',
      params: { entryId: 'entry-1' },
    })
  })

  it('renders vault unlock button when vault is locked', () => {
    useCryptoStore.setState({ isVaultLocked: true })
    render(<MobileNav />)
    expect(screen.getByRole('button', { name: /unlock vault/i })).toBeInTheDocument()
  })

  it('renders vault lock button when vault is unlocked', () => {
    useCryptoStore.setState({ isVaultLocked: false })
    render(<MobileNav />)
    expect(screen.getByRole('button', { name: /lock vault/i })).toBeInTheDocument()
  })

  it('calls lockVault when lock button is clicked while unlocked', async () => {
    useCryptoStore.setState({ isVaultLocked: false })
    const user = userEvent.setup()
    render(<MobileNav />)
    await user.click(screen.getByRole('button', { name: /lock vault/i }))
    expect(mockLockVault).toHaveBeenCalledOnce()
  })

  it('opens unlock dialog when unlock button is clicked while locked', async () => {
    useCryptoStore.setState({ isVaultLocked: true })
    useVaultDialogStore.setState({ isUnlockDialogOpen: false })
    const user = userEvent.setup()
    render(<MobileNav />)
    await user.click(screen.getByRole('button', { name: /unlock vault/i }))
    expect(useVaultDialogStore.getState().isUnlockDialogOpen).toBe(true)
    expect(mockLockVault).not.toHaveBeenCalled()
  })
})
