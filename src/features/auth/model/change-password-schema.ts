import { z } from 'zod'
import { PASSWORD_MIN_LENGTH } from '@/shared/auth/password-utils'

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'changePassword.errors.currentRequired'),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, 'changePassword.errors.newPasswordMin'),
    confirmPassword: z.string().min(1, 'changePassword.errors.confirmRequired'),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'changePassword.errors.sameAsCurrent',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'changePassword.errors.passwordMismatch',
    path: ['confirmPassword'],
  })

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
