import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { AuthLayout } from '@/features/auth/ui/AuthLayout'
import { FormField } from '@/shared/ui/FormField'
import { registerSchema, type RegisterFormData } from '@/features/auth/model/register-schema'
import { registerUser } from '@/features/auth/model/auth-credentials'
import { getAuthErrorMessage } from '@/features/auth/model/auth-errors'
import { toast } from 'sonner'

function RegisterPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(data: RegisterFormData) {
    try {
      await registerUser(data.username, data.password)
      await navigate({ to: '/dashboard' })
    } catch (error) {
      toast.error(getAuthErrorMessage(error, t))
    }
  }

  return (
    <AuthLayout
      title={t('register.title')}
      description={t('common:app.tagline')}
      footer={
        <>
          {t('register.hasAccount')}{' '}
          <Link to="/login" className="text-primary underline">
            {t('register.loginLink')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          id="username"
          label={t('register.username')}
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
          label={t('register.password')}
          error={errors.password?.message ? t(errors.password.message) : undefined}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
        <FormField
          id="confirm-password"
          label={t('register.confirmPassword')}
          error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
        >
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('register.submitting') : t('register.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}

export { RegisterPage }
