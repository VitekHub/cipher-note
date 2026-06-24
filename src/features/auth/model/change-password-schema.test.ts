import { describe, it, expect } from 'vitest'
import { changePasswordSchema } from '@/features/auth/model/change-password-schema'

describe('changePasswordSchema', () => {
  it('passes with valid data', async () => {
    const result = await changePasswordSchema.safeParseAsync({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
      confirmPassword: 'newPassword456',
    })
    expect(result.success).toBe(true)
  })

  it('fails when current password is empty', async () => {
    const result = await changePasswordSchema.safeParseAsync({
      currentPassword: '',
      newPassword: 'newPassword456',
      confirmPassword: 'newPassword456',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'currentPassword')).toBe(true)
    }
  })

  it('fails when new password is too short', async () => {
    const result = await changePasswordSchema.safeParseAsync({
      currentPassword: 'oldPassword',
      newPassword: 'short',
      confirmPassword: 'short',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'newPassword')).toBe(true)
    }
  })

  it('fails when new password matches current password', async () => {
    const result = await changePasswordSchema.safeParseAsync({
      currentPassword: 'samePassword',
      newPassword: 'samePassword',
      confirmPassword: 'samePassword',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const sameError = result.error.issues.find((i) => i.message === 'changePassword.errors.sameAsCurrent')
      expect(sameError).toBeDefined()
      expect(sameError!.path).toContain('newPassword')
    }
  })

  it('fails when confirm password does not match', async () => {
    const result = await changePasswordSchema.safeParseAsync({
      currentPassword: 'oldPassword',
      newPassword: 'newPassword1',
      confirmPassword: 'newPassword2',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const mismatchError = result.error.issues.find((i) => i.message === 'changePassword.errors.passwordMismatch')
      expect(mismatchError).toBeDefined()
      expect(mismatchError!.path).toContain('confirmPassword')
    }
  })

  it('fails when confirm password is empty', async () => {
    const result = await changePasswordSchema.safeParseAsync({
      currentPassword: 'oldPassword',
      newPassword: 'newPassword1',
      confirmPassword: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'confirmPassword')).toBe(true)
    }
  })
})
