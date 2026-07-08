import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { CryptoError, DecryptionError, CorruptedDataError } from '@/shared/crypto/core/errors'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'

describe('CryptoError classes', () => {
  it('CryptoError has correct name', () => {
    const error = new CryptoError('test error')
    expect(error.name).toBe('CryptoError')
    expect(error.message).toBe('test error')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(CryptoError)
  })

  it('DecryptionError extends CryptoError', () => {
    const error = new DecryptionError()
    expect(error.name).toBe('DecryptionError')
    expect(error.message).toBe('vault:errors.decryptFailed')
    expect(error).toBeInstanceOf(CryptoError)
    expect(error).toBeInstanceOf(Error)
  })

  it('DecryptionError accepts custom message', () => {
    const error = new DecryptionError('custom message')
    expect(error.message).toBe('custom message')
  })

  it('CorruptedDataError extends CryptoError', () => {
    const error = new CorruptedDataError()
    expect(error.name).toBe('CorruptedDataError')
    expect(error.message).toBe('vault:errors.corruptedData')
    expect(error).toBeInstanceOf(CryptoError)
    expect(error).toBeInstanceOf(Error)
  })

  it('CorruptedDataError accepts custom message', () => {
    const error = new CorruptedDataError('custom message')
    expect(error.message).toBe('custom message')
  })
})

describe('RouteErrorBoundary', () => {
  const reset = vi.fn()

  it('renders the title and a retry button', () => {
    render(<RouteErrorBoundary error={new Error('boom')} reset={reset} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('maps DecryptionError to the corruption copy', () => {
    render(<RouteErrorBoundary error={new DecryptionError()} reset={reset} />)
    expect(screen.getByText('Decryption failed. Your data may be corrupted.')).toBeInTheDocument()
  })

  it('maps a network AuthError to the network copy', () => {
    render(<RouteErrorBoundary error={new AuthError(AuthErrorCode.NETWORK_ERROR)} reset={reset} />)
    expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
  })

  it('maps an unknown error to the unexpected copy', () => {
    render(<RouteErrorBoundary error={new Error('unexpected')} reset={reset} />)
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument()
  })

  it('accepts a non-Error value via coercion', () => {
    render(<RouteErrorBoundary error={new Error('string error')} reset={reset} />)
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument()
  })
})
