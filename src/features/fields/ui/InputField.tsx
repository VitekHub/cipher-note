import { useTranslation } from 'react-i18next'

import { Input } from '@/shared/ui/input'
import type { FieldName } from '@/shared/types/entities/field.types'

/** Config for single-line input fields. Derives HTML attributes and i18n keys from field name.
 *  Keys are stored statically so i18next-parser can discover them. */
const INPUT_FIELD_CONFIG: Record<
  Extract<FieldName, 'title' | 'website' | 'email'>,
  { type: string; autoComplete: string; labelKey: string; placeholderKey: string }
> = {
  title: { type: 'text', autoComplete: 'off', labelKey: 'title.label', placeholderKey: 'title.placeholder' },
  website: {
    type: 'url',
    autoComplete: 'url',
    labelKey: 'website.label',
    placeholderKey: 'website.placeholder',
  },
  email: {
    type: 'email',
    autoComplete: 'email',
    labelKey: 'email.label',
    placeholderKey: 'email.placeholder',
  },
}

interface InputFieldProps {
  fieldName: Extract<FieldName, 'title' | 'website' | 'email'>
  value: string
  onChange: (value: string) => void
  ref?: React.Ref<HTMLInputElement>
}

function InputField({ fieldName, value, onChange, ref }: InputFieldProps) {
  const { t } = useTranslation('fields')
  const config = INPUT_FIELD_CONFIG[fieldName]

  return (
    <Input
      ref={ref}
      type={config.type}
      autoComplete={config.autoComplete}
      aria-label={t(config.labelKey)}
      spellCheck={false}
      placeholder={t(config.placeholderKey)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={`field-input-${fieldName}`}
    />
  )
}

export { InputField }
