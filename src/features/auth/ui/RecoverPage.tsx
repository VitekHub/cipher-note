import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { AuthLayout } from '@/features/auth/ui/AuthLayout'
import { MnemonicInput } from '@/features/auth/ui/MnemonicInput'
import { UsernameField } from '@/features/auth/ui/UsernameField'
import { PasswordField } from '@/features/auth/ui/PasswordField'
import { PasswordStrength } from '@/features/auth/ui/PasswordStrength'
import { SubmitButton } from '@/shared/ui/form/SubmitButton'
import {
  recoveryStep1Schema,
  recoveryStep2Schema,
  type RecoveryStep1FormData,
  type RecoveryStep2FormData,
} from '@/features/auth/model/recovery-schema'
import { getRecoveryErrorMessage } from '@/features/auth/model/recovery-error-messages'
import { recoveryFlow, RecoveryLoginError } from '@/features/auth/model/mnemonic-service'
import { DecryptionError, MnemonicError } from '@/shared/crypto/core/errors'

const EMPTY_WORDS = () => Array.from({ length: 12 }, () => '')

type RecoveryStep = 'mnemonic' | 'newPassword'

function RecoverPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [step, setStep] = useState<RecoveryStep>('mnemonic')
  const [words, setWords] = useState<string[]>(EMPTY_WORDS)
  const [mnemonicValid, setMnemonicValid] = useState(false)
  const [mnemonicError, setMnemonicError] = useState<string | undefined>()
  const cardRef = useRef<HTMLDivElement>(null)

  // Zero-fill recovery state on unmount
  useEffect(() => {
    return () => {
      recoveryFlow.clear()
    }
  }, [])

  // ── Step 1: Mnemonic form ──────────────────────────────────────────

  const step1Methods = useForm<RecoveryStep1FormData>({
    resolver: standardSchemaResolver(recoveryStep1Schema),
    defaultValues: { username: '' },
  })

  const {
    handleSubmit: handleSubmitStep1,
    formState: { isSubmitting: isSubmittingStep1 },
  } = step1Methods

  const handleMnemonicChange = useCallback((newWords: string[]) => {
    setWords(newWords)
    setMnemonicError(undefined)
  }, [])

  const handleMnemonicValidityChange = useCallback((valid: boolean) => {
    setMnemonicValid(valid)
  }, [])

  async function onStep1Submit(data: RecoveryStep1FormData) {
    setMnemonicError(undefined)
    const mnemonic = words.join(' ')
    try {
      await recoveryFlow.validateMnemonic(data.username, mnemonic)
      setStep('newPassword')
    } catch (error) {
      if (error instanceof DecryptionError) {
        setMnemonicError(t('recover.errors.wrongMnemonic'))
      } else if (error instanceof MnemonicError) {
        setMnemonicError(t('recover.errors.invalidMnemonic'))
      } else {
        toast.error(getRecoveryErrorMessage(error, t))
      }
    }
  }

  // ── Step 2: New Password form ─────────────────────────────────────

  const step2Methods = useForm<RecoveryStep2FormData>({
    resolver: standardSchemaResolver(recoveryStep2Schema),
    defaultValues: { newPassword: '', confirmNewPassword: '' },
  })

  const {
    handleSubmit: handleSubmitStep2,
    control: controlStep2,
    formState: { isSubmitting: isSubmittingStep2 },
  } = step2Methods

  const watchedNewPassword = useWatch({ control: controlStep2, name: 'newPassword' })

  async function onStep2Submit(data: RecoveryStep2FormData) {
    try {
      await recoveryFlow.setNewPassword(data.newPassword)
      await navigate({ to: '/dashboard' })
    } catch (error) {
      if (error instanceof RecoveryLoginError) {
        // Password was changed on the server but automatic login failed.
        // Direct the user to log in manually with their new password.
        toast.success(t('recover.passwordChangedLogin'))
        await navigate({ to: '/login' })
      } else {
        toast.error(getRecoveryErrorMessage(error, t))
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  const step1Footer = (
    <>
      {t('recover.backToLogin')}{' '}
      <Link to="/login" className="text-primary underline">
        {t('login.title')}
      </Link>
    </>
  )

  if (step === 'mnemonic') {
    return (
      <AuthLayout title={t('recover.title')} description={t('recover.description')} footer={step1Footer}>
        <FormProvider {...step1Methods}>
          <form onSubmit={handleSubmitStep1(onStep1Submit)} className="space-y-4" noValidate>
            <UsernameField />
            <MnemonicInput
              value={words}
              onChange={handleMnemonicChange}
              onValidityChange={handleMnemonicValidityChange}
              error={mnemonicError}
            />
            <SubmitButton
              isSubmitting={isSubmittingStep1}
              submitLabel={t('recover.submit')}
              submittingLabel={t('recover.submitting')}
              disabled={!mnemonicValid}
              dataTestId="recover-submit"
            />
          </form>
        </FormProvider>
      </AuthLayout>
    )
  }

  // step === 'newPassword'
  return (
    <AuthLayout ref={cardRef} title={t('recover.newPasswordTitle')} description={t('recover.newPasswordDescription')}>
      <FormProvider {...step2Methods}>
        <form onSubmit={handleSubmitStep2(onStep2Submit)} className="space-y-4" noValidate>
          <PasswordField name="newPassword" label={t('recover.newPassword')} autoComplete="new-password" autoFocus />
          <PasswordStrength password={watchedNewPassword ?? ''} anchorRef={cardRef} container={cardRef} />
          <PasswordField
            name="confirmNewPassword"
            label={t('recover.confirmNewPassword')}
            autoComplete="new-password"
          />
          <SubmitButton
            isSubmitting={isSubmittingStep2}
            submitLabel={t('recover.setPassword')}
            submittingLabel={t('recover.settingPassword')}
            dataTestId="recover-set-password"
          />
        </form>
      </FormProvider>
    </AuthLayout>
  )
}

export { RecoverPage }
