import { describe, it, expect } from 'vitest'
import { mapErrorToMessage, type ErrorKeySpec } from '@/shared/lib/error-messages'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { DecryptionError, CorruptedDataError, Argon2Error } from '@/shared/crypto/core/errors'
import type { TFunction } from 'i18next'

const mockT = ((key: string) => key) as unknown as TFunction

describe('mapErrorToMessage', () => {
  describe('instanceChecks', () => {
    it('returns the key for the first matching error class', () => {
      const spec: ErrorKeySpec = {
        instanceChecks: [
          [DecryptionError, 'errors.wrongPassword'],
          [CorruptedDataError, 'errors.corruptedData'],
          [Argon2Error, 'errors.argon2Failed'],
        ],
        fallbackKey: 'errors.unexpected',
      }
      expect(mapErrorToMessage(new DecryptionError(), mockT, spec)).toBe('errors.wrongPassword')
      expect(mapErrorToMessage(new CorruptedDataError(), mockT, spec)).toBe('errors.corruptedData')
      expect(mapErrorToMessage(new Argon2Error(), mockT, spec)).toBe('errors.argon2Failed')
    })

    it('skips non-matching instance checks and falls through', () => {
      const spec: ErrorKeySpec = {
        instanceChecks: [[DecryptionError, 'errors.wrongPassword']],
        networkKey: 'errors.network',
        fallbackKey: 'errors.unexpected',
      }
      expect(mapErrorToMessage(new CorruptedDataError(), mockT, spec)).toBe('errors.unexpected')
    })
  })

  describe('authCodes', () => {
    const spec: ErrorKeySpec = {
      authCodes: {
        [AuthErrorCode.INVALID_CREDENTIALS]: 'errors.invalidCredentials',
        [AuthErrorCode.NETWORK_ERROR]: 'errors.networkError',
      },
      fallbackKey: 'errors.unexpected',
    }

    it('returns the key for a mapped AuthErrorCode', () => {
      expect(mapErrorToMessage(new AuthError(AuthErrorCode.INVALID_CREDENTIALS), mockT, spec)).toBe(
        'errors.invalidCredentials',
      )
      expect(mapErrorToMessage(new AuthError(AuthErrorCode.NETWORK_ERROR), mockT, spec)).toBe('errors.networkError')
    })

    it('falls through for an unmapped AuthErrorCode', () => {
      expect(mapErrorToMessage(new AuthError(AuthErrorCode.UNEXPECTED), mockT, spec)).toBe('errors.unexpected')
    })
  })

  describe('apiCodes', () => {
    const spec: ErrorKeySpec = {
      apiCodes: {
        [ApiErrorCode.NETWORK_ERROR]: 'errors.networkError',
        [ApiErrorCode.NOT_FOUND]: 'errors.notFound',
      },
      fallbackKey: 'errors.unexpected',
    }

    it('returns the key for a mapped ApiErrorCode', () => {
      expect(mapErrorToMessage(new ApiError(ApiErrorCode.NETWORK_ERROR), mockT, spec)).toBe('errors.networkError')
      expect(mapErrorToMessage(new ApiError(ApiErrorCode.NOT_FOUND), mockT, spec)).toBe('errors.notFound')
    })

    it('falls through for an unmapped ApiErrorCode', () => {
      expect(mapErrorToMessage(new ApiError(ApiErrorCode.UNEXPECTED), mockT, spec)).toBe('errors.unexpected')
    })
  })

  describe('networkKey', () => {
    const spec: ErrorKeySpec = {
      networkKey: 'errors.networkError',
      fallbackKey: 'errors.unexpected',
    }

    it('returns networkKey for TypeError with "Failed to fetch" message', () => {
      expect(mapErrorToMessage(new TypeError('Failed to fetch'), mockT, spec)).toBe('errors.networkError')
    })

    it('returns networkKey for error with "Network" in message', () => {
      expect(mapErrorToMessage(new Error('A Network failure occurred'), mockT, spec)).toBe('errors.networkError')
    })

    it('returns fallbackKey when networkKey is not set', () => {
      const noNetworkSpec: ErrorKeySpec = { fallbackKey: 'errors.unexpected' }
      expect(mapErrorToMessage(new TypeError('Failed to fetch'), mockT, noNetworkSpec)).toBe('errors.unexpected')
    })
  })

  describe('fallbackKey', () => {
    it('returns fallbackKey for unknown errors', () => {
      const spec: ErrorKeySpec = { fallbackKey: 'errors.unexpected' }
      expect(mapErrorToMessage(new Error('something'), mockT, spec)).toBe('errors.unexpected')
    })

    it('returns fallbackKey for non-Error values', () => {
      const spec: ErrorKeySpec = { fallbackKey: 'errors.unexpected' }
      expect(mapErrorToMessage('string error', mockT, spec)).toBe('errors.unexpected')
      expect(mapErrorToMessage(null, mockT, spec)).toBe('errors.unexpected')
    })
  })

  describe('dispatch order', () => {
    const spec: ErrorKeySpec = {
      instanceChecks: [[DecryptionError, 'instance.match']],
      authCodes: { [AuthErrorCode.INVALID_CREDENTIALS]: 'auth.match' },
      apiCodes: { [ApiErrorCode.NETWORK_ERROR]: 'api.match' },
      networkKey: 'network.match',
      fallbackKey: 'fallback.match',
    }

    it('instanceChecks takes priority over authCodes', () => {
      expect(mapErrorToMessage(new DecryptionError(), mockT, spec)).toBe('instance.match')
    })

    it('authCodes takes priority over apiCodes', () => {
      expect(mapErrorToMessage(new AuthError(AuthErrorCode.INVALID_CREDENTIALS), mockT, spec)).toBe('auth.match')
    })

    it('apiCodes takes priority over networkKey', () => {
      expect(mapErrorToMessage(new ApiError(ApiErrorCode.NETWORK_ERROR), mockT, spec)).toBe('api.match')
    })

    it('networkKey is checked after authCodes and apiCodes', () => {
      expect(mapErrorToMessage(new TypeError('Failed to fetch'), mockT, spec)).toBe('network.match')
    })

    it('falls back to fallbackKey when nothing matches', () => {
      expect(mapErrorToMessage(new Error('unknown'), mockT, spec)).toBe('fallback.match')
    })
  })

  describe('real-world spec: vault errors', () => {
    const vaultSpec: ErrorKeySpec = {
      instanceChecks: [
        [DecryptionError, 'errors.wrongPassword'],
        [CorruptedDataError, 'errors.corruptedData'],
        [Argon2Error, 'errors.argon2Failed'],
      ],
      networkKey: 'common:errors.networkError',
      fallbackKey: 'common:errors.unexpectedError',
    }

    it('maps DecryptionError', () => {
      expect(mapErrorToMessage(new DecryptionError(), mockT, vaultSpec)).toBe('errors.wrongPassword')
    })

    it('maps CorruptedDataError', () => {
      expect(mapErrorToMessage(new CorruptedDataError(), mockT, vaultSpec)).toBe('errors.corruptedData')
    })

    it('maps Argon2Error', () => {
      expect(mapErrorToMessage(new Argon2Error(), mockT, vaultSpec)).toBe('errors.argon2Failed')
    })

    it('maps network errors', () => {
      expect(mapErrorToMessage(new TypeError('Failed to fetch'), mockT, vaultSpec)).toBe('common:errors.networkError')
    })

    it('maps unknown errors to fallback', () => {
      expect(mapErrorToMessage(new Error('weird'), mockT, vaultSpec)).toBe('common:errors.unexpectedError')
    })
  })

  describe('real-world spec: auth errors', () => {
    const authSpec: ErrorKeySpec = {
      authCodes: {
        [AuthErrorCode.INVALID_CREDENTIALS]: 'errors.invalidCredentials',
        [AuthErrorCode.USERNAME_TAKEN]: 'errors.usernameTaken',
        [AuthErrorCode.NETWORK_ERROR]: 'errors.networkError',
        [AuthErrorCode.UNEXPECTED]: 'errors.unexpectedError',
      },
      apiCodes: {
        [ApiErrorCode.NETWORK_ERROR]: 'errors.networkError',
        [ApiErrorCode.NOT_FOUND]: 'errors.unexpectedError',
        [ApiErrorCode.UNEXPECTED]: 'errors.unexpectedError',
      },
      networkKey: 'errors.networkError',
      fallbackKey: 'errors.unexpectedError',
    }

    it('maps AuthError codes', () => {
      expect(mapErrorToMessage(new AuthError(AuthErrorCode.INVALID_CREDENTIALS), mockT, authSpec)).toBe(
        'errors.invalidCredentials',
      )
      expect(mapErrorToMessage(new AuthError(AuthErrorCode.USERNAME_TAKEN), mockT, authSpec)).toBe(
        'errors.usernameTaken',
      )
      expect(mapErrorToMessage(new AuthError(AuthErrorCode.NETWORK_ERROR), mockT, authSpec)).toBe('errors.networkError')
      expect(mapErrorToMessage(new AuthError(AuthErrorCode.UNEXPECTED), mockT, authSpec)).toBe('errors.unexpectedError')
    })

    it('maps ApiError codes', () => {
      expect(mapErrorToMessage(new ApiError(ApiErrorCode.NETWORK_ERROR), mockT, authSpec)).toBe('errors.networkError')
      expect(mapErrorToMessage(new ApiError(ApiErrorCode.NOT_FOUND), mockT, authSpec)).toBe('errors.unexpectedError')
      expect(mapErrorToMessage(new ApiError(ApiErrorCode.UNEXPECTED), mockT, authSpec)).toBe('errors.unexpectedError')
    })

    it('maps network errors', () => {
      expect(mapErrorToMessage(new TypeError('Failed to fetch'), mockT, authSpec)).toBe('errors.networkError')
    })

    it('maps unknown errors to fallback', () => {
      expect(mapErrorToMessage(new Error('unknown'), mockT, authSpec)).toBe('errors.unexpectedError')
    })
  })
})
