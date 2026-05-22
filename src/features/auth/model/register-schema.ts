import { z } from 'zod'
import { USERNAME_PATTERN } from '@/shared/auth/username-utils'
import { PASSWORD_MIN_LENGTH } from '@/shared/auth/password-utils'

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'register.errors.usernameMin')
      .max(32, 'register.errors.usernameMax')
      .regex(USERNAME_PATTERN, 'register.errors.usernamePattern'),
    password: z.string().min(PASSWORD_MIN_LENGTH, 'register.errors.passwordMin'),
    confirmPassword: z.string().min(1, 'register.errors.confirmRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'register.errors.passwordMismatch',
    path: ['confirmPassword'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>
