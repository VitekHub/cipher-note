import { Link, useNavigate, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { logoutUser } from '@/features/auth/model/auth-credentials'

function ProtectedLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  async function handleLogout() {
    await logoutUser()
    navigate({ to: '/login' })
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <aside className="hidden border-r md:block md:w-60">
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold">{t('app.name')}</h2>
          </div>
          <nav className="flex-1 space-y-1 p-2">
            <Link
              to="/dashboard"
              className="hover:bg-muted [&.active]:bg-muted flex items-center rounded-md px-3 py-2 text-sm font-medium"
            >
              {t('common:nav.dashboard')}
            </Link>
            <Link
              to="/settings"
              className="hover:bg-muted [&.active]:bg-muted flex items-center rounded-md px-3 py-2 text-sm font-medium"
            >
              {t('common:nav.settings')}
            </Link>
          </nav>
          <div className="border-t p-4">
            <Button variant="outline" className="w-full" size="sm" onClick={handleLogout}>
              {t('common:nav.logout')}
            </Button>
          </div>
        </div>
      </aside>

      <header className="border-b md:hidden">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold">{t('app.name')}</h2>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}

export { ProtectedLayout }
