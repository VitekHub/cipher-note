import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { DecryptionError } from '@/shared/crypto/core/errors'
import { AuthError, AuthErrorCode } from '@/shared/auth/auth-errors'
import { ApiError, ApiErrorCode } from '@/shared/api/api-errors'
import { getKeyRotationErrorMessage } from '@/features/fields/model/key-rotation-error-messages'

const mockT = ((key: string) => key) as unknown as TFunction<'vault'>

describe('getKeyRotationErrorMessage', () => {
  it('maps DecryptionError to the stale-vault message', () => {
    expect(getKeyRotationErrorMessage(new DecryptionError(), mockT)).toBe('rotation.staleVault')
  })

  it('maps ApiError(NETWORK_ERROR) to the network message', () => {
    expect(getKeyRotationErrorMessage(new ApiError(ApiErrorCode.NETWORK_ERROR), mockT)).toBe('rotation.networkError')
  })

  it('maps ApiError(UNEXPECTED) to the "unchanged" message', () => {
    expect(getKeyRotationErrorMessage(new ApiError(ApiErrorCode.UNEXPECTED), mockT)).toBe('rotation.failed')
  })

  it('maps AuthError(NETWORK_ERROR) to the network message', () => {
    expect(getKeyRotationErrorMessage(new AuthError(AuthErrorCode.NETWORK_ERROR), mockT)).toBe('rotation.networkError')
  })

  it('maps a raw TypeError("Failed to fetch") (network bypass) to the network message', () => {
    expect(getKeyRotationErrorMessage(new TypeError('Failed to fetch'), mockT)).toBe('rotation.networkError')
  })

  it('maps a generic locked-vault Error to the locked message', () => {
    expect(getKeyRotationErrorMessage(new Error('Vault is locked — cannot rotate'), mockT)).toBe('rotation.locked')
  })
})
