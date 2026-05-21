import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { registerSchema, type RegisterFormData } from '@/features/auth/model/register-schema'
import { AuthForm, type AuthFieldConfig } from '@/features/auth/ui/AuthForm'
import { MnemonicDialog } from '@/features/auth/ui/MnemonicDialog'
import { PasswordStrength } from '@/features/auth/ui/PasswordStrength'

const registerFields: AuthFieldConfig<RegisterFormData>[] = [
  { name: 'username', id: 'username', type: 'text', autoComplete: 'username' },
  { name: 'password', id: 'password', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', id: 'confirm-password', type: 'password', autoComplete: 'new-password' },
]

interface RegisterPageProps {
  onSubmit: (username: string, password: string) => Promise<unknown>
}

function RegisterPage({ onSubmit }: RegisterPageProps) {
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const navigate = useNavigate()

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
        schema={registerSchema}
        defaultValues={{ username: '', password: '', confirmPassword: '' }}
        fields={registerFields}
        onSubmit={onSubmit}
        onSuccess={handleSuccess}
        watchFields={['password']}
        i18nPrefix="register"
        successRedirect="/dashboard"
        footer={{ textKey: 'register.hasAccount', linkLabelKey: 'register.loginLink', linkTo: '/login' }}
        renderAfterField={(fieldName, values) =>
          fieldName === 'password' ? (
            <PasswordStrength password={(values as Record<string, string>).password ?? ''} />
          ) : null
        }
      />
      <MnemonicDialog open={showMnemonic} mnemonic={mnemonic ?? ''} onContinue={handleMnemonicContinue} />
    </>
  )
}

export { RegisterPage }
export type { RegisterPageProps }
