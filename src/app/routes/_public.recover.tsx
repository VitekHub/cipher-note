import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

function RecoverPage() {
  const { t } = useTranslation('auth')

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('recover.title')}</CardTitle>
        <CardDescription>{t('recover.description', 'Enter your seed phrase to recover your account.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t('login.username')}</Label>
          <Input id="username" type="text" autoComplete="username" />
        </div>
        <Button className="w-full">{t('recover.submit', 'Recover Account')}</Button>
        <p className="text-muted-foreground text-center text-sm">
          <Link to="/login" className="text-primary underline">
            {t('login.title')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

const Route = createFileRoute('/_public/recover')({
  component: RecoverPage,
})

export { Route }
