import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormField } from '@/shared/ui/form/FormField'
import { Input } from '@/shared/ui/input'

/**
 * Username input connected to react-hook-form via FormProvider.
 *
 * Must be rendered inside a <FormProvider> wrapping the form.
 * Always binds to the "username" field name with autoComplete="username".
 * Derives register, errors, and isSubmitting from form context.
 * Translates Zod error messages via i18next 'auth' namespace.
 */
function UsernameField() {
  const {
    register,
    formState: { errors, isSubmitting },
  } = useFormContext()
  const { t } = useTranslation('auth')

  const errorMessage = errors.username?.message
  const error = errorMessage ? t(errorMessage as string) : undefined

  return (
    <FormField id="username" label={t('username')} error={error}>
      <Input
        id="username"
        type="text"
        autoComplete="username"
        disabled={isSubmitting}
        aria-invalid={!!error}
        {...register('username')}
      />
    </FormField>
  )
}

export { UsernameField }
