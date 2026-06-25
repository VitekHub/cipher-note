import type { ReactNode } from 'react'
import { useFormContext, type FieldValues } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormField } from '@/shared/ui/form/FormField'
import { Input } from '@/shared/ui/input'

/** Converts camelCase field name to kebab-case HTML id (e.g. "confirmPassword" → "confirm-password") */
function toHtmlId(name: string): string {
  return name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

interface PasswordFieldProps {
  /** Form field name — must match a key in the form data (e.g. "password", "confirmPassword") */
  name: string
  label: ReactNode
  autoComplete: 'current-password' | 'new-password'
  autoFocus?: boolean
}

/**
 * Password input connected to react-hook-form via FormProvider.
 *
 * Must be rendered inside a <FormProvider> wrapping the form.
 * Derives register, errors, and isSubmitting from form context.
 * Translates Zod error messages via i18next 'auth' namespace.
 */
function PasswordField({ name, label, autoComplete, autoFocus }: PasswordFieldProps) {
  const {
    register,
    formState: { errors, isSubmitting },
  } = useFormContext<FieldValues>()
  const { t } = useTranslation('auth')

  const errorMessage = errors[name]?.message
  const error = errorMessage ? t(String(errorMessage)) : undefined
  const id = toHtmlId(name)

  return (
    <FormField id={id} label={label} error={error}>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        disabled={isSubmitting}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        {...register(name)}
      />
    </FormField>
  )
}

export { PasswordField }
export type { PasswordFieldProps }
