import { z } from 'zod'
import { USERNAME_PATTERN } from '@/shared/auth/username-utils'

export const loginSchema = z.object({
  username: z.string().min(1, 'login.errors.usernameRequired').regex(USERNAME_PATTERN, 'login.errors.usernamePattern'),
  password: z.string().min(1, 'login.errors.passwordRequired'),
})

export type LoginFormData = z.infer<typeof loginSchema>
