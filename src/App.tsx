import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeProvider } from '@/shared/lib/theme-provider'

function AppContent() {
  const { t } = useTranslation()

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      <main className="container mx-auto flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('app.name')}</CardTitle>
            <CardDescription>{t('app.tagline')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full">{t('nav.login')}</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppContent />
    </ThemeProvider>
  )
}

export default App
