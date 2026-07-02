import { z } from 'zod/v4'
import { USERNAME_PATTERN } from '@/shared/auth/username-utils'
import { PASSWORD_MIN_LENGTH } from '@/shared/auth/password-utils'

export const recoveryStep1Schema = z.object({
  username: z
    .string()
    .min(1, 'recover.errors.usernameRequired')
    .regex(USERNAME_PATTERN, 'recover.errors.usernamePattern'),
  mnemonic: z.string().min(1, 'recover.errors.mnemonicRequired'),
})

export const recoveryStep2Schema = z
  .object({
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, 'recover.errors.newPasswordMin'),
    confirmNewPassword: z.string().min(1, 'recover.errors.confirmRequired'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'recover.errors.passwordMismatch',
    path: ['confirmNewPassword'],
  })

export type RecoveryStep1FormData = z.infer<typeof recoveryStep1Schema>
export type RecoveryStep2FormData = z.infer<typeof recoveryStep2Schema>
