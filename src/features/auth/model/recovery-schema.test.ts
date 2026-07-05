import { describe, it, expect } from 'vitest'
import { recoveryStep1Schema, recoveryStep2Schema } from '@/features/auth/model/recovery-schema'

describe('recoveryStep1Schema', () => {
  it('passes with valid username', async () => {
    const result = await recoveryStep1Schema.safeParseAsync({
      username: 'testuser',
    })
    expect(result.success).toBe(true)
  })

  it('fails when username is empty', async () => {
    const result = await recoveryStep1Schema.safeParseAsync({
      username: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const usernameError = result.error.issues.find((i) => i.path[0] === 'username')
      expect(usernameError).toBeDefined()
      expect(usernameError!.message).toBe('recover.errors.usernameRequired')
    }
  })

  it('fails when username is too short (less than 3 chars)', async () => {
    const result = await recoveryStep1Schema.safeParseAsync({
      username: 'ab',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const usernameError = result.error.issues.find((i) => i.path[0] === 'username')
      expect(usernameError).toBeDefined()
      expect(usernameError!.message).toBe('recover.errors.usernamePattern')
    }
  })

  it('fails when username contains invalid characters', async () => {
    const result = await recoveryStep1Schema.safeParseAsync({
      username: 'test@user',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const usernameError = result.error.issues.find((i) => i.path[0] === 'username')
      expect(usernameError).toBeDefined()
      expect(usernameError!.message).toBe('recover.errors.usernamePattern')
    }
  })

  it('passes with username containing underscores', async () => {
    const result = await recoveryStep1Schema.safeParseAsync({
      username: 'test_user_123',
    })
    expect(result.success).toBe(true)
  })
})

describe('recoveryStep2Schema', () => {
  it('passes with valid matching passwords', async () => {
    const result = await recoveryStep2Schema.safeParseAsync({
      newPassword: 'strongPassword123',
      confirmNewPassword: 'strongPassword123',
    })
    expect(result.success).toBe(true)
  })

  it('fails when new password is too short', async () => {
    const result = await recoveryStep2Schema.safeParseAsync({
      newPassword: 'short',
      confirmNewPassword: 'short',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordError = result.error.issues.find((i) => i.path[0] === 'newPassword')
      expect(passwordError).toBeDefined()
      expect(passwordError!.message).toBe('recover.errors.newPasswordMin')
    }
  })

  it('fails when confirm password is empty', async () => {
    const result = await recoveryStep2Schema.safeParseAsync({
      newPassword: 'validPassword123',
      confirmNewPassword: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const confirmError = result.error.issues.find((i) => i.path[0] === 'confirmNewPassword')
      expect(confirmError).toBeDefined()
      expect(confirmError!.message).toBe('recover.errors.confirmRequired')
    }
  })

  it('fails when passwords do not match', async () => {
    const result = await recoveryStep2Schema.safeParseAsync({
      newPassword: 'passwordOne123',
      confirmNewPassword: 'passwordTwo456',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const mismatchError = result.error.issues.find((i) => i.message === 'recover.errors.passwordMismatch')
      expect(mismatchError).toBeDefined()
      expect(mismatchError!.path).toContain('confirmNewPassword')
    }
  })
})
