import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useForm, type FieldValues, type Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType } from 'zod'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { AuthLayout } from '@/features/auth/ui/AuthLayout'
import { FormField } from '@/shared/ui/FormField'
import { getAuthErrorMessage } from '@/features/auth/model/auth-errors'
import { isSafeRedirect } from '@/features/auth/ui/url-utils'
import { toast } from 'sonner'

interface AuthFieldConfig<T extends Record<string, unknown>> {
  name: keyof T & string
  id: string
  type: string
  autoComplete: string
}

interface AuthFooterConfig {
  textKey: string
  linkLabelKey: string
  linkTo: string
}

interface AuthFormConfig<T extends FieldValues> {
  schema: ZodType<T>
  defaultValues: T
  fields: AuthFieldConfig<T>[]
  onSubmit: (username: string, password: string) => Promise<unknown>
  i18nPrefix: string
  successRedirect: string
  redirectUrl?: string
  footer: AuthFooterConfig
}

function AuthForm<T extends FieldValues>({
  schema,
  defaultValues,
  fields,
  onSubmit,
  i18nPrefix,
  successRedirect,
  redirectUrl,
  footer,
}: AuthFormConfig<T>) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  async function onFormSubmit(data: T) {
    try {
      const { username, password } = data as unknown as Record<string, string>
      await onSubmit(username, password)
      const redirectTo = redirectUrl && isSafeRedirect(redirectUrl) ? redirectUrl : successRedirect
      await navigate({ to: redirectTo })
    } catch (error) {
      toast.error(getAuthErrorMessage(error, t))
    }
  }

  return (
    <AuthLayout
      title={t(`${i18nPrefix}.title`)}
      description={t('common:app.tagline')}
      footer={
        <>
          {t(footer.textKey)}{' '}
          <Link to={footer.linkTo} className="text-primary underline">
            {t(footer.linkLabelKey)}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" noValidate>
        {fields.map((field) => {
          const errorKey = errors[field.name as keyof T]?.message as string | undefined
          return (
            <FormField
              key={field.id}
              id={field.id}
              label={t(`${i18nPrefix}.${field.name}`)}
              error={errorKey ? t(errorKey) : undefined}
            >
              <Input
                id={field.id}
                type={field.type}
                autoComplete={field.autoComplete}
                disabled={isSubmitting}
                aria-invalid={!!errors[field.name as keyof T]}
                {...register(field.name as Path<T>)}
              />
            </FormField>
          )
        })}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t(`${i18nPrefix}.submitting`) : t(`${i18nPrefix}.submit`)}
        </Button>
      </form>
    </AuthLayout>
  )
}

export { AuthForm }
export type { AuthFieldConfig, AuthFooterConfig }
