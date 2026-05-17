import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

function DashboardPage() {
  const { t } = useTranslation('common')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('nav.dashboard')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Unlock vault to view</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Website</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Unlock vault to view</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Unlock vault to view</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

export { Route }
