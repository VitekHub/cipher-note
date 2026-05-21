import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import {
  useForm,
  useWatch,
  type FieldValues,
  type Path,
  type Resolver,
  type SubmitHandler,
  type DefaultValues,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { AuthLayout } from '@/features/auth/ui/AuthLayout'
import { FormField } from '@/shared/ui/form/FormField'
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
  onSuccess?: (result: unknown) => void
  renderAfterField?: (fieldName: string, formValues: Record<string, unknown>) => ReactNode
  watchFields?: string[]
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
  onSuccess,
  renderAfterField,
  watchFields,
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
    control,
    formState: { errors, isSubmitting },
  } = useForm<T>({
    resolver: zodResolver(schema) as Resolver<T>,
    defaultValues: defaultValues as DefaultValues<T>,
  })

  const watchedValues = useWatch({ control, name: watchFields }) as Record<string, unknown>

  const onFormSubmit = async (data: T) => {
    try {
      const { username, password } = data as unknown as Record<string, string>
      const result = await onSubmit(username, password)
      if (onSuccess) {
        onSuccess(result)
      } else {
        const redirectTo = redirectUrl && isSafeRedirect(redirectUrl) ? redirectUrl : successRedirect
        await navigate({ to: redirectTo })
      }
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
      <form onSubmit={handleSubmit(onFormSubmit as SubmitHandler<FieldValues>)} className="space-y-4" noValidate>
        {fields.map((field) => {
          const errorKey = errors[field.name as keyof T]?.message as string | undefined
          return (
            <div key={field.id}>
              <FormField
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
              {renderAfterField?.(field.name as string, watchedValues)}
            </div>
          )
        })}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? t(`${i18nPrefix}.submitting`) : t(`${i18nPrefix}.submit`)}
        </Button>
      </form>
    </AuthLayout>
  )
}

export { AuthForm }
export type { AuthFieldConfig, AuthFooterConfig }
