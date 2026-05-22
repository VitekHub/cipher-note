import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { registerSchema, type RegisterFormData } from '@/features/auth/model/register-schema'
import { useUsernameAvailability } from '@/features/auth/model/use-username-availability'
import { AuthForm, type AuthFieldConfig } from '@/features/auth/ui/AuthForm'
import { MnemonicDialog } from '@/features/auth/ui/MnemonicDialog'
import { PasswordStrength } from '@/features/auth/ui/PasswordStrength'
import { UsernameAvailability } from '@/features/auth/ui/UsernameAvailability'

const registerFields: AuthFieldConfig<RegisterFormData>[] = [
  { name: 'username', id: 'username', type: 'text', autoComplete: 'username' },
  { name: 'password', id: 'password', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', id: 'confirm-password', type: 'password', autoComplete: 'new-password' },
]

interface RegisterPageProps {
  onSubmit: (username: string, password: string) => Promise<unknown>
}

function RegisterPage({ onSubmit }: RegisterPageProps) {
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', password: '', confirmPassword: '' },
  })
  const watchedUsername = useWatch({ control: form.control, name: 'username' })
  const { status: availabilityStatus } = useUsernameAvailability({ username: watchedUsername ?? '' })

  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()

  const isSubmitDisabled = availabilityStatus === 'checking' || availabilityStatus === 'taken'

  const fieldsWithFocus = registerFields.map((f) =>
    f.name === 'password'
      ? { ...f, onFocus: () => setPasswordFocused(true), onBlur: () => setPasswordFocused(false) }
      : f,
  )

  function handleSuccess(result: unknown) {
    if (typeof result !== 'string') return
    setMnemonic(result)
    setShowMnemonic(true)
  }

  function handleMnemonicContinue() {
    setShowMnemonic(false)
    navigate({ to: '/dashboard' })
  }

  return (
    <>
      <AuthForm<RegisterFormData>
        form={form}
        fields={fieldsWithFocus}
        onSubmit={onSubmit}
        onSuccess={handleSuccess}
        watchFields={['password']}
        i18nPrefix="register"
        successRedirect="/dashboard"
        containerRef={cardRef}
        isSubmitDisabled={isSubmitDisabled}
        footer={{ textKey: 'register.hasAccount', linkLabelKey: 'register.loginLink', linkTo: '/login' }}
        renderAfterField={(fieldName, values) => {
          const formValues = values as Record<string, string>
          if (fieldName === 'username') {
            return <UsernameAvailability status={availabilityStatus} />
          }
          if (fieldName === 'password') {
            return (
              <PasswordStrength
                password={formValues.password ?? ''}
                open={passwordFocused}
                onOpenChange={setPasswordFocused}
                anchorRef={cardRef}
              />
            )
          }
          return null
        }}
      />
      <MnemonicDialog open={showMnemonic} mnemonic={mnemonic ?? ''} onContinue={handleMnemonicContinue} />
    </>
  )
}

export { RegisterPage }
export type { RegisterPageProps }
