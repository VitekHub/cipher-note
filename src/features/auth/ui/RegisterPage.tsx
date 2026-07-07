import { useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useTranslation } from 'react-i18next'
import { registerSchema, type RegisterFormData } from '@/features/auth/model/register-schema'
import { useUsernameAvailability } from '@/features/auth/model/use-username-availability'
import { AuthLayout } from '@/features/auth/ui/AuthLayout'
import { SubmitButton } from '@/shared/ui/form/SubmitButton'
import { MnemonicDialog } from '@/features/auth/ui/MnemonicDialog'
import { PasswordField } from '@/features/auth/ui/PasswordField'
import { PasswordStrength } from '@/features/auth/ui/PasswordStrength'
import { UsernameField } from '@/features/auth/ui/UsernameField'
import { UsernameAvailability } from '@/features/auth/ui/UsernameAvailability'
import { getAuthErrorMessage } from '@/features/auth/model/auth-error-messages'
import { toast } from 'sonner'

interface RegisterPageProps {
  onSubmit: (username: string, password: string) => Promise<unknown>
}

function RegisterPage({ onSubmit }: RegisterPageProps) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()

  const methods = useForm<RegisterFormData>({
    resolver: standardSchemaResolver(registerSchema),
    defaultValues: { username: '', password: '', confirmPassword: '' },
  })

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = methods

  const watchedUsername = useWatch({ control, name: 'username' })
  const watchedPassword = useWatch({ control, name: 'password' })
  const { status: availabilityStatus } = useUsernameAvailability({ username: watchedUsername ?? '' })

  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const isSubmitDisabled = isSubmitting || availabilityStatus === 'checking' || availabilityStatus === 'taken'

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
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" noValidate>
            <UsernameField />
            <UsernameAvailability status={availabilityStatus} />

            <PasswordField name="password" label={t('password')} autoComplete="new-password" />
            <PasswordStrength password={watchedPassword ?? ''} anchorRef={cardRef} />

            <PasswordField name="confirmPassword" label={t('register.confirmPassword')} autoComplete="new-password" />

            <SubmitButton
              isSubmitting={isSubmitting}
              submitLabel={t('register.submit')}
              submittingLabel={t('register.submitting')}
              disabled={isSubmitDisabled}
              dataTestId="register-submit"
            />
          </form>
        </FormProvider>
      </AuthLayout>
      <MnemonicDialog open={showMnemonic} mnemonic={mnemonic ?? ''} onContinue={handleMnemonicContinue} />
    </>
  )
}

export { RegisterPage }
