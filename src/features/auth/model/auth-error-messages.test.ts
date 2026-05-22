import { describe, it, expect, vi } from 'vitest'
import { getAuthErrorMessage } from '@/features/auth/model/auth-error-messages'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'

const t = vi.fn((key: string) => key)

describe('getAuthErrorMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AuthError code mapping', () => {
    it('maps INVALID_CREDENTIALS to invalidCredentials', () => {
      getAuthErrorMessage(new AuthError(AuthErrorCode.INVALID_CREDENTIALS), t)
      expect(t).toHaveBeenCalledWith('errors.invalidCredentials')
    })

    it('maps USERNAME_TAKEN to usernameTaken', () => {
      getAuthErrorMessage(new AuthError(AuthErrorCode.USERNAME_TAKEN), t)
      expect(t).toHaveBeenCalledWith('errors.usernameTaken')
    })

    it('maps NETWORK_ERROR to networkError', () => {
      getAuthErrorMessage(new AuthError(AuthErrorCode.NETWORK_ERROR), t)
      expect(t).toHaveBeenCalledWith('errors.networkError')
    })

    it('maps KEYS_NOT_FOUND to unexpectedError', () => {
      getAuthErrorMessage(new AuthError(AuthErrorCode.KEYS_NOT_FOUND), t)
      expect(t).toHaveBeenCalledWith('errors.unexpectedError')
    })

    it('maps UNEXPECTED to unexpectedError', () => {
      getAuthErrorMessage(new AuthError(AuthErrorCode.UNEXPECTED), t)
      expect(t).toHaveBeenCalledWith('errors.unexpectedError')
    })
  })

  describe('network error fallback', () => {
    it('maps TypeError "Failed to fetch" to networkError', () => {
      getAuthErrorMessage(new TypeError('Failed to fetch'), t)
      expect(t).toHaveBeenCalledWith('errors.networkError')
    })

    it('maps "NetworkError" to networkError', () => {
      getAuthErrorMessage(new Error('NetworkError'), t)
      expect(t).toHaveBeenCalledWith('errors.networkError')
    })

    it('maps message containing "network" (case-insensitive) to networkError', () => {
      getAuthErrorMessage(new Error('A Network failure occurred'), t)
      expect(t).toHaveBeenCalledWith('errors.networkError')
    })
  })

  it('maps unknown Error to unexpectedError', () => {
    getAuthErrorMessage(new Error('Something weird happened'), t)
    expect(t).toHaveBeenCalledWith('errors.unexpectedError')
  })

  it('maps non-Error objects to unexpectedError', () => {
    getAuthErrorMessage('string error', t)
    expect(t).toHaveBeenCalledWith('errors.unexpectedError')
  })

  it('maps null to unexpectedError', () => {
    getAuthErrorMessage(null, t)
    expect(t).toHaveBeenCalledWith('errors.unexpectedError')
  })
})
