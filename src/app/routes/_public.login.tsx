import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

function LoginPage() {
  const { t } = useTranslation('auth')

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('login.title')}</CardTitle>
        <CardDescription>{t('common:app.tagline', 'Your notes. Your privacy. Your control.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t('login.username')}</Label>
          <Input id="username" type="text" autoComplete="username" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('login.password')}</Label>
          <Input id="password" type="password" autoComplete="current-password" />
        </div>
        <Button className="w-full">{t('login.submit')}</Button>
        <p className="text-muted-foreground text-center text-sm">
          {t('login.noAccount')}{' '}
          <Link to="/register" className="text-primary underline">
            {t('login.registerLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

const Route = createFileRoute('/_public/login')({
  component: LoginPage,
})

export { Route }
