import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import React from 'react'

vi.mock('@/features/encryption/model/registration', () => ({
  deriveRegistrationKeys: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    authSalt: new Uint8Array(16).fill(0x01),
    keySalt: new Uint8Array(16).fill(0x02),
    masterKey: new Uint8Array(32).fill(0x03),
    kek: new Uint8Array(32).fill(0x04),
    fieldKeys: new Map([
      ['note', new Uint8Array(32).fill(0x10)],
      ['website', new Uint8Array(32).fill(0x20)],
      ['email', new Uint8Array(32).fill(0x30)],
    ]),
    wrappedMasterKey: new Uint8Array(48).fill(0x05),
    masterKeyIV: new Uint8Array(12).fill(0x06),
    wrappedFieldKeys: [],
    recoveryData: {
      recoverySalt: new Uint8Array(16).fill(0xaa),
      wrappedMasterKey: new Uint8Array(48).fill(0xbb),
      recoveryIV: new Uint8Array(12).fill(0xcc),
    },
    mnemonic: 'word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11',
  }),
}))

vi.mock('@/features/encryption/model/upload-keys', () => ({
  uploadRegistrationData: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/shared/crypto/memory', () => ({
  hexEncode: vi.fn((data: Uint8Array) =>
    Array.from(data)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join(''),
  ),
}))

vi.mock('@/shared/auth/supabase-adapter', () => ({
  authAdapter: {
    login: vi.fn(),
    signup: vi.fn().mockResolvedValue({
      user: { id: '1', username: 'newuser', createdAt: '2024-01-01' },
      session: { accessToken: 'tok', expiresAt: 0 },
    }),
    logout: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
  useNavigate: () => vi.fn(),
}))

import { RegisterPage } from '@/features/auth/ui/RegisterPage'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { toast } from 'sonner'

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, session: null, isLoading: false })
  })

  it('renders username, password, confirm password inputs and submit button', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows validation error for short password', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/^password$/i), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for password mismatch', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid username pattern', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'Bad Username!')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/lowercase letters/i)).toBeInTheDocument()
    })
  })

  it('calls registerUser on valid form submission', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(authAdapter.signup).toHaveBeenCalled()
    })
  })

  it('shows error toast on registration failure', async () => {
    vi.mocked(authAdapter.signup).mockRejectedValueOnce(new Error('User already registered'))
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/^password$/i), 'testpass123')
    await user.type(screen.getByLabelText(/confirm password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Username already taken')
    })
  })

  it('displays link to login page', () => {
    render(<RegisterPage />)
    expect(screen.getByText(/log in/i)).toBeInTheDocument()
  })
})
