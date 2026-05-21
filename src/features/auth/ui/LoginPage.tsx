import { loginSchema, type LoginFormData } from '@/features/auth/model/login-schema'
import { loginUser } from '@/app/flows/auth-flow'
import { AuthForm, type AuthFieldConfig } from '@/features/auth/ui/AuthForm'

const loginFields: AuthFieldConfig<LoginFormData>[] = [
  { name: 'username', id: 'username', type: 'text', autoComplete: 'username' },
  { name: 'password', id: 'password', type: 'password', autoComplete: 'current-password' },
]

interface LoginPageProps {
  redirectUrl?: string
}

function LoginPage({ redirectUrl }: LoginPageProps) {
  return (
    <AuthForm<LoginFormData>
      schema={loginSchema}
      defaultValues={{ username: '', password: '' }}
      fields={loginFields}
      onSubmit={loginUser}
      i18nPrefix="login"
      successRedirect="/dashboard"
      redirectUrl={redirectUrl}
      footer={{ textKey: 'login.noAccount', linkLabelKey: 'login.registerLink', linkTo: '/register' }}
    />
  )
}

export { LoginPage }
