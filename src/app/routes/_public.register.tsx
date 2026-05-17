import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

function RegisterPage() {
  const { t } = useTranslation('auth')

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('register.title')}</CardTitle>
        <CardDescription>{t('common:app.tagline', 'Your notes. Your privacy. Your control.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t('register.username')}</Label>
          <Input id="username" type="text" autoComplete="username" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('register.password')}</Label>
          <Input id="password" type="password" autoComplete="new-password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t('register.confirmPassword')}</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" />
        </div>
        <Button className="w-full">{t('register.submit')}</Button>
        <p className="text-muted-foreground text-center text-sm">
          {t('register.hasAccount')}{' '}
          <Link to="/login" className="text-primary underline">
            {t('register.loginLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

const Route = createFileRoute('/_public/register')({
  component: RegisterPage,
})

export { Route }
