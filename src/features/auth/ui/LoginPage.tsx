import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { loginSchema, type LoginFormData } from '@/features/auth/model/login-schema'
import { loginUser } from '@/app/flows/auth-flow'
import { AuthLayout } from '@/features/auth/ui/AuthLayout'
import { FormField } from '@/shared/ui/form/FormField'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { getAuthErrorMessage } from '@/features/auth/model/auth-error-messages'
import { isSafeRedirect } from '@/features/auth/ui/url-utils'
import { toast } from 'sonner'

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
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

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
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" noValidate>
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
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}

export { LoginPage }
