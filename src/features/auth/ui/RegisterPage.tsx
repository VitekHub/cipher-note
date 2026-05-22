import { useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { registerSchema, type RegisterFormData } from '@/features/auth/model/register-schema'
import { useUsernameAvailability } from '@/features/auth/model/use-username-availability'
import { AuthLayout } from '@/features/auth/ui/AuthLayout'
import { FormField } from '@/shared/ui/form/FormField'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { MnemonicDialog } from '@/features/auth/ui/MnemonicDialog'
import { PasswordStrength } from '@/features/auth/ui/PasswordStrength'
import { UsernameAvailability } from '@/features/auth/ui/UsernameAvailability'
import { getAuthErrorMessage } from '@/features/auth/model/auth-error-messages'
import { toast } from 'sonner'

interface RegisterPageProps {
  onSubmit: (username: string, password: string) => Promise<unknown>
}

function RegisterPage({ onSubmit }: RegisterPageProps) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', password: '', confirmPassword: '' },
  })

  const watchedUsername = useWatch({ control, name: 'username' })
  const watchedPassword = useWatch({ control, name: 'password' })
  const { status: availabilityStatus } = useUsernameAvailability({ username: watchedUsername ?? '' })

  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const cardRef = useRef<HTMLElement>(null)

  const isSubmitDisabled = isSubmitting || availabilityStatus === 'checking' || availabilityStatus === 'taken'

  const { ref: passwordRef, ...passwordRest } = register('password')

  async function onFormSubmit(data: RegisterFormData) {
    try {
      const result = await onSubmit(data.username, data.password)
      if (typeof result !== 'string') return
      setMnemonic(result)
      setShowMnemonic(true)
    } catch (error) {
      toast.error(getAuthErrorMessage(error, t))
    }
  }

  function handleMnemonicContinue() {
    setShowMnemonic(false)
    navigate({ to: '/dashboard' })
  }

  return (
    <>
      <AuthLayout
        ref={cardRef}
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
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" noValidate>
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
          <UsernameAvailability status={availabilityStatus} />

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
              {...passwordRest}
              ref={passwordRef}
              onFocus={() => setPasswordFocused(true)}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                passwordRest.onBlur(e)
                setPasswordFocused(false)
              }}
            />
          </FormField>
          <PasswordStrength
            password={watchedPassword ?? ''}
            open={passwordFocused}
            onOpenChange={setPasswordFocused}
            anchorRef={cardRef}
          />

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

          <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? t('register.submitting') : t('register.submit')}
          </Button>
        </form>
      </AuthLayout>
      <MnemonicDialog open={showMnemonic} mnemonic={mnemonic ?? ''} onContinue={handleMnemonicContinue} />
    </>
  )
}

export { RegisterPage }
