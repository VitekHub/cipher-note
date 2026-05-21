import { registerSchema, type RegisterFormData } from '@/features/auth/model/register-schema'
import { AuthForm, type AuthFieldConfig } from '@/features/auth/ui/AuthForm'

const registerFields: AuthFieldConfig<RegisterFormData>[] = [
  { name: 'username', id: 'username', type: 'text', autoComplete: 'username' },
  { name: 'password', id: 'password', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', id: 'confirm-password', type: 'password', autoComplete: 'new-password' },
]

interface RegisterPageProps {
  onSubmit: (username: string, password: string) => Promise<unknown>
}

function RegisterPage({ onSubmit }: RegisterPageProps) {
  return (
    <AuthForm<RegisterFormData>
      schema={registerSchema}
      defaultValues={{ username: '', password: '', confirmPassword: '' }}
      fields={registerFields}
      onSubmit={onSubmit}
      i18nPrefix="register"
      successRedirect="/dashboard"
      footer={{ textKey: 'register.hasAccount', linkLabelKey: 'register.loginLink', linkTo: '/login' }}
    />
  )
}

export { RegisterPage }
export type { RegisterPageProps }
