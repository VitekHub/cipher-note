import { forwardRef, type ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

interface AuthLayoutProps {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

const AuthLayout = forwardRef<HTMLElement, AuthLayoutProps>(function AuthLayout(
  { title, description, children, footer },
  ref,
) {
  return (
    <Card ref={ref} className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {footer ? <div className="text-muted-foreground text-center text-sm">{footer}</div> : null}
      </CardContent>
    </Card>
  )
})

export { AuthLayout }
