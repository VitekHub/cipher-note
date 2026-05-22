import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import React from 'react'

vi.mock('@/shared/crypto/split-kdf', () => ({
  deriveLoginCredentials: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    passwordKey: new Uint8Array(32).fill(0x07),
  }),
  deriveAuthCredentials: vi.fn().mockResolvedValue({
    authHash: 'a'.repeat(64),
    passwordKey: new Uint8Array(32).fill(0x07),
    authSalt: new Uint8Array(16).fill(0x01),
    keySalt: new Uint8Array(16).fill(0x02),
  }),
}))

vi.mock('@/shared/api/supabase-keys', () => ({
  getLoginSalts: vi.fn().mockResolvedValue({
    authSalt: '01'.repeat(16),
    keySalt: '02'.repeat(16),
  }),
  getKeys: vi.fn().mockResolvedValue({
    authSalt: '01'.repeat(16),
    keySalt: '02'.repeat(16),
    wrappedMasterKey: '05'.repeat(48),
    masterKeyIV: '06'.repeat(12),
  }),
  getFieldKeys: vi
    .fn()
    .mockResolvedValue([{ fieldName: 'note', version: 1, wrappedKey: 'aa'.repeat(48), keyIV: 'bb'.repeat(12) }]),
}))

vi.mock('@/features/encryption/model/login', () => ({
  deriveLoginKeys: vi.fn().mockResolvedValue({
    masterKey: new Uint8Array(32).fill(0x03),
    kek: {},
    fieldKeys: new Map([['note', new Uint8Array(32).fill(0x10)]]),
  }),
}))

vi.mock('@/features/encryption/model/vault-lock', () => ({
  lockVault: vi.fn(),
  unlockVault: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/shared/crypto/memory', () => ({
  hexEncode: vi.fn((data: Uint8Array) =>
    Array.from(data)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join(''),
  ),
  hexDecode: vi.fn((hex: string) => {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes
  }),
  encodeFieldKeysToHex: vi.fn((fieldKeys: Map<string, Uint8Array>) => {
    const result: Record<string, string> = {}
    for (const [name, key] of fieldKeys) {
      result[name] = Array.from(key)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }
    return result
  }),
}))

vi.mock('@/shared/crypto/aes-gcm', () => ({
  exportKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0x04)),
  importKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  generateIV: vi.fn(),
  generateKey: vi.fn(),
}))

vi.mock('@/shared/auth/supabase-adapter', () => ({
  authAdapter: {
    login: vi.fn().mockResolvedValue({
      user: { id: '1', username: 'testuser', createdAt: '2024-01-01' },
      session: { accessToken: 'tok', expiresAt: 0 },
    }),
    signup: vi.fn(),
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

import { LoginPage } from '@/features/auth/ui/LoginPage'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { useAuthStore } from '@/features/auth/model/auth-store'
import { toast } from 'sonner'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, session: null, isLoading: false })
  })

  it('renders username and password inputs and submit button', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields on submit', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid username pattern', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/username/i), 'Invalid User!')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText(/3-32 letters/i)).toBeInTheDocument()
    })
  })

  it('disables inputs and button during submission', async () => {
    vi.mocked(authAdapter.login).mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeDisabled()
      expect(screen.getByLabelText(/password/i)).toBeDisabled()
      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled()
    })
  })

  it('calls loginUser on valid form submission', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'testpass123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(authAdapter.login).toHaveBeenCalled()
    })
  })

  it('shows error toast on login failure', async () => {
    vi.mocked(authAdapter.login).mockRejectedValueOnce(new Error('Invalid login credentials'))
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.type(screen.getByLabelText(/password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid username or password')
    })
  })

  it('displays link to register page', () => {
    render(<LoginPage />)
    expect(screen.getByText(/create one/i)).toBeInTheDocument()
  })
})
