import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import type { FieldName } from '@/shared/types/entities/field.types'
import type { CachedVaultEnvelope } from '@/shared/types/api.types'

const { mockInvalidateQueries, mockRotateFieldKey } = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  mockRotateFieldKey: vi.fn<(userId: string, fieldName: FieldName) => Promise<number>>(),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/fields/model/key-rotation-service', () => ({
  rotateFieldKey: mockRotateFieldKey,
}))

import { RotateFieldKeyDialog } from './RotateFieldKeyDialog'
import { toast } from 'sonner'
import { useRotateFieldKeyDialogStore } from '@/shared/stores/dialogs-store'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { useCryptoStore } from '@/shared/crypto/vault/crypto-store'
import { queryKeys } from '@/shared/lib/query-keys'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'

const mockToast = vi.mocked(toast)

function envelopeWith(versions: Partial<Record<string, number>> = {}): CachedVaultEnvelope {
  const base = [
    { fieldName: 'title', version: 1, wrappedFieldKey: '01'.repeat(48), fieldKeyIV: '02'.repeat(12) },
    { fieldName: 'note', version: 1, wrappedFieldKey: '03'.repeat(48), fieldKeyIV: '04'.repeat(12) },
    { fieldName: 'website', version: 1, wrappedFieldKey: '05'.repeat(48), fieldKeyIV: '06'.repeat(12) },
    { fieldName: 'email', version: 1, wrappedFieldKey: '07'.repeat(48), fieldKeyIV: '08'.repeat(12) },
  ]
  return {
    kdfSalt: 'a1b2c3d4'.repeat(4),
    wrappedMasterKey: 'aa'.repeat(48),
    masterKeyIV: 'bb'.repeat(12),
    fieldKeys: base.map((k) => ({ ...k, version: versions[k.fieldName] ?? k.version })),
  }
}

/** Mock rotation that simulates the service bumping the cached-envelope version. */
function rotatingMock(failingFields: Set<FieldName> = new Set()) {
  mockRotateFieldKey.mockImplementation(async (_userId: string, fieldName: FieldName) => {
    if (failingFields.has(fieldName)) throw new ApiError(ApiErrorCode.NETWORK_ERROR)
    const key = useCryptoStore.getState().cachedEnvelope?.fieldKeys.find((k) => k.fieldName === fieldName)
    const newVersion = (key?.version ?? 1) + 1
    useCryptoStore.setState((s) => {
      if (!s.cachedEnvelope) return {}
      return {
        cachedEnvelope: {
          ...s.cachedEnvelope,
          fieldKeys: s.cachedEnvelope.fieldKeys.map((k) =>
            k.fieldName === fieldName ? { ...k, version: k.version + 1 } : k,
          ),
        },
      }
    })
    return newVersion
  })
}

function envelopeVersion(fieldName: FieldName): number {
  const k = useCryptoStore.getState().cachedEnvelope?.fieldKeys.find((f) => f.fieldName === fieldName)
  return k ? k.version : 1
}

describe('RotateFieldKeyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRotateFieldKeyDialogStore.setState({ isOpen: false, payload: null })
    useAuthStore.setState({ user: { id: 'user-1', username: 'testuser', createdAt: '2024-01-01' } })
    useCryptoStore.setState({ isVaultLocked: false, cachedEnvelope: envelopeWith() })
  })

  it('renders single-field confirmation copy when the payload names a field', () => {
    useRotateFieldKeyDialogStore.setState({ isOpen: true, payload: { fieldName: 'note' } })

    render(<RotateFieldKeyDialog />)

    expect(screen.getByText('Rotate Note key?')).toBeInTheDocument()
    expect(
      screen.getByText('This re-encrypts your Note data across all entries. This cannot be undone.'),
    ).toBeInTheDocument()
  })

  it('renders rotate-all confirmation copy when the payload field is null', () => {
    useRotateFieldKeyDialogStore.setState({ isOpen: true, payload: { fieldName: null } })

    render(<RotateFieldKeyDialog />)

    expect(screen.getByText('Rotate all field keys?')).toBeInTheDocument()
    expect(screen.getByText('This re-encrypts all of your data. This cannot be undone.')).toBeInTheDocument()
  })

  it('does not render the confirmation when closed', () => {
    useRotateFieldKeyDialogStore.setState({ isOpen: false, payload: null })

    render(<RotateFieldKeyDialog />)

    expect(screen.queryByText('Rotate all field keys?')).not.toBeInTheDocument()
  })

  it('cancel closes the dialog without calling the service and clears the payload', async () => {
    const user = userEvent.setup()
    useRotateFieldKeyDialogStore.setState({ isOpen: true, payload: { fieldName: 'note' } })
    rotatingMock()

    render(<RotateFieldKeyDialog />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useRotateFieldKeyDialogStore.getState().isOpen).toBe(false)
    expect(useRotateFieldKeyDialogStore.getState().payload).toBeNull()
    expect(mockRotateFieldKey).not.toHaveBeenCalled()
  })

  it('confirm (single field) calls rotateFieldKey, invalidates field queries, toasts success, and closes', async () => {
    const user = userEvent.setup()
    useRotateFieldKeyDialogStore.setState({ isOpen: true, payload: { fieldName: 'note' } })
    rotatingMock()

    render(<RotateFieldKeyDialog />)

    await user.click(screen.getByRole('button', { name: 'Rotate' }))

    await vi.waitFor(() => {
      expect(mockRotateFieldKey).toHaveBeenCalledWith('user-1', 'note')
    })

    await vi.waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.field.all })
      expect(mockToast.success).toHaveBeenCalledWith('Note key rotated to v2')
      expect(useRotateFieldKeyDialogStore.getState().isOpen).toBe(false)
    })
  })

  it('confirm (rotate-all) rotates all four fields sequentially and surfaces per-field results', async () => {
    const user = userEvent.setup()
    useRotateFieldKeyDialogStore.setState({ isOpen: true, payload: { fieldName: null } })

    // 3rd field (website) fails; first two and the 4th succeed.
    rotatingMock(new Set(['website']))

    render(<RotateFieldKeyDialog />)

    await user.click(screen.getByRole('button', { name: 'Rotate all field keys' }))

    await vi.waitFor(() => {
      expect(mockRotateFieldKey).toHaveBeenCalledTimes(4)
    })
    expect(mockRotateFieldKey).toHaveBeenNthCalledWith(1, 'user-1', 'title')
    expect(mockRotateFieldKey).toHaveBeenNthCalledWith(2, 'user-1', 'note')
    expect(mockRotateFieldKey).toHaveBeenNthCalledWith(3, 'user-1', 'website')
    expect(mockRotateFieldKey).toHaveBeenNthCalledWith(4, 'user-1', 'email')

    await vi.waitFor(() => {
      // Success toasts for the three that rotated.
      expect(mockToast.success).toHaveBeenCalledWith('Title key rotated to v2')
      expect(mockToast.success).toHaveBeenCalledWith('Note key rotated to v2')
      expect(mockToast.success).toHaveBeenCalledWith('Email key rotated to v2')
      // Error toast for the field that failed.
      expect(mockToast.error).toHaveBeenCalledWith('Network error — rotation not applied.', {
        description: 'Website',
      })
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.field.all })
      expect(useRotateFieldKeyDialogStore.getState().isOpen).toBe(false)
    })

    // First two + 4th rotated; 3rd untouched.
    expect(envelopeVersion('title')).toBe(2)
    expect(envelopeVersion('note')).toBe(2)
    expect(envelopeVersion('website')).toBe(1)
    expect(envelopeVersion('email')).toBe(2)
  })

  it('service throws ApiError(NETWORK_ERROR): mapped network toast, no invalidation, no vault mutation', async () => {
    const user = userEvent.setup()
    useRotateFieldKeyDialogStore.setState({ isOpen: true, payload: { fieldName: 'note' } })
    mockRotateFieldKey.mockRejectedValueOnce(new ApiError(ApiErrorCode.NETWORK_ERROR))

    render(<RotateFieldKeyDialog />)

    await user.click(screen.getByRole('button', { name: 'Rotate' }))

    await vi.waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Network error — rotation not applied.', {
        description: 'Note',
      })
      expect(useRotateFieldKeyDialogStore.getState().isOpen).toBe(false)
    })

    expect(mockInvalidateQueries).not.toHaveBeenCalled()
    expect(mockToast.success).not.toHaveBeenCalled()
    // The cached envelope was not bumped.
    expect(envelopeVersion('note')).toBe(1)
  })
})
