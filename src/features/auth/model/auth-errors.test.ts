import { describe, it, expect, vi } from 'vitest'
import { getAuthErrorMessage } from '@/features/auth/model/auth-errors'

const t = vi.fn((key: string) => key)

describe('getAuthErrorMessage', () => {
  describe('status code matching', () => {
    it('maps 401 to invalidCredentials', () => {
      const error = Object.assign(new Error('Unauthorized'), { status: 401 })
      getAuthErrorMessage(error, t)
      expect(t).toHaveBeenCalledWith('errors.invalidCredentials')
    })

    it('maps 403 to invalidCredentials', () => {
      const error = Object.assign(new Error('Forbidden'), { status: 403 })
      getAuthErrorMessage(error, t)
      expect(t).toHaveBeenCalledWith('errors.invalidCredentials')
    })

    it('maps 409 to usernameTaken', () => {
      const error = Object.assign(new Error('Conflict'), { status: 409 })
      getAuthErrorMessage(error, t)
      expect(t).toHaveBeenCalledWith('errors.usernameTaken')
    })

    it('maps 422 to usernameTaken', () => {
      const error = Object.assign(new Error('Unprocessable'), { status: 422 })
      getAuthErrorMessage(error, t)
      expect(t).toHaveBeenCalledWith('errors.usernameTaken')
    })
  })

  describe('exact message matching', () => {
    it('maps "Invalid login credentials" to invalidCredentials', () => {
      getAuthErrorMessage(new Error('Invalid login credentials'), t)
      expect(t).toHaveBeenCalledWith('errors.invalidCredentials')
    })

    it('maps "Invalid password" to invalidCredentials', () => {
      getAuthErrorMessage(new Error('Invalid password'), t)
      expect(t).toHaveBeenCalledWith('errors.invalidCredentials')
    })

    it('maps "Login salts not found for this username" to invalidCredentials', () => {
      getAuthErrorMessage(new Error('Login salts not found for this username'), t)
      expect(t).toHaveBeenCalledWith('errors.invalidCredentials')
    })

    it('maps "Invalid username format" to invalidCredentials', () => {
      getAuthErrorMessage(new Error('Invalid username format'), t)
      expect(t).toHaveBeenCalledWith('errors.invalidCredentials')
    })

    it('maps "User already registered" to usernameTaken', () => {
      getAuthErrorMessage(new Error('User already registered'), t)
      expect(t).toHaveBeenCalledWith('errors.usernameTaken')
    })

    it('maps "User already exists" to usernameTaken', () => {
      getAuthErrorMessage(new Error('User already exists'), t)
      expect(t).toHaveBeenCalledWith('errors.usernameTaken')
    })
  })

  describe('network errors', () => {
    it('maps "Failed to fetch" exactly', () => {
      getAuthErrorMessage(new Error('Failed to fetch'), t)
      expect(t).toHaveBeenCalledWith('errors.networkError')
    })

    it('maps "NetworkError" exactly', () => {
      getAuthErrorMessage(new Error('NetworkError'), t)
      expect(t).toHaveBeenCalledWith('errors.networkError')
    })

    it('maps message containing "network" (case-insensitive)', () => {
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
