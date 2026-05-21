import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetLoading = vi.fn()
const mockSetAuth = vi.fn()

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

vi.mock('@/shared/api/supabase-registration', () => ({
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
    signup: vi.fn().mockResolvedValue({
      user: { id: '1', username: 'test', createdAt: '' },
      session: { accessToken: 'tok', expiresAt: 0 },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/features/auth/model/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      setLoading: mockSetLoading,
      setAuth: mockSetAuth,
    })),
  },
}))

import { handleRegister } from '@/app/flows/registration-flow'
import { deriveRegistrationKeys } from '@/features/encryption/model/registration'
import { useCryptoStore } from '@/features/encryption/model/crypto-store'
import { hexEncode } from '@/shared/crypto/memory'
import { authAdapter } from '@/shared/auth/supabase-adapter'
import { uploadRegistrationData } from '@/shared/api/supabase-registration'

describe('handleRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCryptoStore.setState({
      masterKey: null,
      kek: null,
      fieldKeys: {},
      isVaultLocked: true,
      lastActivity: 0,
    })
  })

  it('derives registration keys with password', async () => {
    await handleRegister('testuser', 'testpass123')
    expect(deriveRegistrationKeys).toHaveBeenCalledWith('testpass123')
  })

  it('signs up with auth adapter using username and authHash', async () => {
    await handleRegister('testuser', 'testpass123')
    expect(authAdapter.signup).toHaveBeenCalledWith('testuser', 'a'.repeat(64))
  })

  it('uploads registration data with user ID', async () => {
    await handleRegister('testuser', 'testpass123')
    expect(uploadRegistrationData).toHaveBeenCalledTimes(1)
    const regResult = await (deriveRegistrationKeys as ReturnType<typeof vi.fn>).mock.results[0].value
    const userId = '1'
    expect(uploadRegistrationData).toHaveBeenCalledWith(regResult, userId)
  })

  it('populates crypto store with hex-encoded keys', async () => {
    await handleRegister('testuser', 'testpass123')
    expect(hexEncode).toHaveBeenCalledWith(new Uint8Array(32).fill(0x03))
    expect(hexEncode).toHaveBeenCalledWith(new Uint8Array(32).fill(0x04))
    expect(useCryptoStore.getState().isVaultLocked).toBe(false)
  })

  it('sets auth state on success', async () => {
    await handleRegister('testuser', 'testpass123')
    expect(mockSetAuth).toHaveBeenCalledWith(
      { id: '1', username: 'test', createdAt: '' },
      { accessToken: 'tok', expiresAt: 0 },
    )
  })

  it('sets loading true at start and false on completion', async () => {
    await handleRegister('testuser', 'testpass123')
    expect(mockSetLoading).toHaveBeenCalledWith(true)
    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })

  it('returns result with mnemonic', async () => {
    const result = await handleRegister('testuser', 'testpass123')
    expect(result.mnemonic).toBe('word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11')
  })

  it('attempts logout cleanup when upload fails after signup succeeds', async () => {
    vi.mocked(uploadRegistrationData).mockRejectedValueOnce(new Error('upload failed'))

    await expect(handleRegister('testuser', 'testpass123')).rejects.toThrow('upload failed')
    expect(authAdapter.logout).toHaveBeenCalledTimes(1)
  })

  it('sets loading false even on failure', async () => {
    vi.mocked(uploadRegistrationData).mockRejectedValueOnce(new Error('upload failed'))

    await expect(handleRegister('testuser', 'testpass123')).rejects.toThrow()
    expect(mockSetLoading).toHaveBeenCalledWith(false)
  })
})
