import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import { Outlet } from '@tanstack/react-router'

import { Button } from '@/shared/ui/button'
import { Sheet, SheetTrigger, SheetContent } from '@/shared/ui/sheet'
import { Sidebar } from '@/shared/ui/Sidebar'
import { MobileNav } from '@/shared/ui/MobileNav'
import { VaultIndicator } from '@/features/encryption/ui/VaultIndicator'
import { useUiStore } from '@/features/settings/model/ui-store'

function ProtectedLayout() {
  const { t } = useTranslation('common')
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  return (
    <div className="text-foreground bg-background flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 flex-shrink-0 flex-col border-r md:flex">
        <Sidebar />
      </aside>

      {/* Right column: header + main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger menu */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger
                render={<Button variant="ghost" size="icon" className="md:hidden" aria-label={t('nav.menu')} />}
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" showCloseButton={false} className="bg-sidebar text-sidebar-foreground w-60 p-0">
                <Sidebar onClose={() => setSidebarOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-lg font-semibold md:hidden">{t('app.name')}</span>
          </div>
          <VaultIndicator />
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  )
}

export { ProtectedLayout }
