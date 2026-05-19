import { useNavigate, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { NavLink } from '@/shared/ui/NavLink'
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
            <NavLink to="/dashboard">
              {t('common:nav.dashboard')}
            </NavLink>
            <NavLink to="/settings">
              {t('common:nav.settings')}
            </NavLink>
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
