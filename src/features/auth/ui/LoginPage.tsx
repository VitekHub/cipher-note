import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { AuthLayout } from '@/features/auth/ui/AuthLayout'
import { FormField } from '@/shared/ui/FormField'
import { loginSchema, type LoginFormData } from '@/features/auth/model/login-schema'
import { loginUser } from '@/features/auth/model/auth-credentials'
import { getAuthErrorMessage } from '@/features/auth/model/auth-errors'
import { toast } from 'sonner'
import { isSafeRedirect } from '@/features/auth/ui/url-utils'

interface LoginPageProps {
  redirectUrl?: string
}

function LoginPage({ redirectUrl }: LoginPageProps) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  async function onSubmit(data: LoginFormData) {
    try {
      await loginUser(data.username, data.password)
      const redirectTo = isSafeRedirect(redirectUrl) ? redirectUrl : '/dashboard'
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          id="username"
          label={t('login.username')}
          error={errors.username?.message ? t(errors.username.message) : undefined}
        >
          <Input
            id="username"
            type="text"
            autoComplete="username"
            disabled={isSubmitting}
            aria-invalid={!!errors.username}
            {...register('username')}
          />
        </FormField>
        <FormField
          id="password"
          label={t('login.password')}
          error={errors.password?.message ? t(errors.password.message) : undefined}
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            disabled={isSubmitting}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}

export { LoginPage }
