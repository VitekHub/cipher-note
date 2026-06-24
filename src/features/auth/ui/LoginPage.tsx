import { Link, useNavigate } from '@tanstack/react-router'
import { FormProvider, useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useTranslation } from 'react-i18next'
import { loginSchema, type LoginFormData } from '@/features/auth/model/login-schema'
import { loginUser } from '@/features/auth/model/auth-service'
import { AuthLayout } from '@/features/auth/ui/AuthLayout'
import { SubmitButton } from '@/shared/ui/form/SubmitButton'
import { PasswordField } from '@/features/auth/ui/PasswordField'
import { UsernameField } from '@/features/auth/ui/UsernameField'
import { getAuthErrorMessage } from '@/features/auth/model/auth-error-messages'
import { isSafeRedirect } from '@/features/auth/ui/url-utils'
import { toast } from 'sonner'

interface LoginPageProps {
  redirectUrl?: string
}

function LoginPage({ redirectUrl }: LoginPageProps) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()

  const methods = useForm<LoginFormData>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods

  async function onFormSubmit(data: LoginFormData) {
    try {
      await loginUser(data.username, data.password)
      const redirectTo = redirectUrl && isSafeRedirect(redirectUrl) ? redirectUrl : '/dashboard'
      await navigate({ to: redirectTo })
    } catch (error) {
      toast.error(getAuthErrorMessage(error, t))
    }
  }

  return (
    <AuthLayout
      title={t('login.title')}
      description={t('common:app.tagline')}
      footer={
        <>
          {t('login.noAccount')}{' '}
          <Link to="/register" className="text-primary underline">
            {t('login.registerLink')}
          </Link>
        </>
      }
    >
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" noValidate>
          <UsernameField />
          <PasswordField name="password" label={t('password')} autoComplete="current-password" />
          <SubmitButton
            isSubmitting={isSubmitting}
            submitLabel={t('login.submit')}
            submittingLabel={t('login.submitting')}
          />
        </form>
      </FormProvider>
    </AuthLayout>
  )
}

export { LoginPage }
