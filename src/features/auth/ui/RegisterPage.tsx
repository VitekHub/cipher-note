import { registerSchema, type RegisterFormData } from '@/features/auth/model/register-schema'
import { registerUser } from '@/features/auth/model/auth-credentials'
import { AuthForm, type AuthFieldConfig } from '@/features/auth/ui/AuthForm'

const registerFields: AuthFieldConfig<RegisterFormData>[] = [
  { name: 'username', id: 'username', type: 'text', autoComplete: 'username' },
  { name: 'password', id: 'password', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', id: 'confirm-password', type: 'password', autoComplete: 'new-password' },
]

function RegisterPage() {
  return (
    <AuthForm<RegisterFormData>
      schema={registerSchema}
      defaultValues={{ username: '', password: '', confirmPassword: '' }}
      fields={registerFields}
      onSubmit={registerUser}
      i18nPrefix="register"
      successRedirect="/dashboard"
      footer={{ textKey: 'register.hasAccount', linkLabelKey: 'register.loginLink', linkTo: '/login' }}
    />
  )
}

export { RegisterPage }
