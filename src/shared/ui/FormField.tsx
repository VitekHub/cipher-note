import { Children, cloneElement, isValidElement, type ReactNode } from 'react'
import { Label } from '@/shared/ui/label'

interface FormFieldProps {
  id: string
  label: ReactNode
  error?: string
  children: ReactNode
}

function FormField({ id, label, error, children }: FormFieldProps) {
  const errorId = `${id}-error`
  const child = Children.only(children)
  const inputWithAria =
    isValidElement<Record<string, unknown>>(child) && error
      ? cloneElement(child, { 'aria-describedby': errorId })
      : child

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {inputWithAria}
      {error ? (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export { FormField }
