import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import { Outlet } from '@tanstack/react-router'

import { Button } from '@/shared/ui/button'
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/shared/ui/sheet'
import { Sidebar } from '@/shared/ui/nav/Sidebar'
import { MobileNav } from '@/shared/ui/nav/MobileNav'
import { ResizeHandle } from '@/shared/ui/nav/ResizeHandle'
import { VaultIndicator } from '@/features/encryption/ui/VaultIndicator'
import { VaultUnlockDialog } from '@/features/encryption/ui/VaultUnlockDialog'
import { useUiStore } from '@/features/settings/model/ui-store'
import { useResizable } from '@/shared/lib/use-resizable'
import { useVaultTimeout } from '@/features/encryption/model/vault-timeout'
import { logoutUser } from '@/app/flows/auth-flow'

function ProtectedLayout() {
  const { t } = useTranslation('common')
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const sidebarWidth = useUiStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth)
  const {
    width: currentSidebarWidth,
    isDragging,
    handleProps,
  } = useResizable({
    storedWidth: sidebarWidth,
    onWidthChange: setSidebarWidth,
  })

  useVaultTimeout()

  return (
    <div className="text-foreground bg-background flex h-screen">
      {/* Desktop sidebar */}
      <aside
        className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden flex-shrink-0 flex-col border-r md:flex"
        style={{ width: `${currentSidebarWidth}px` }}
      >
        <Sidebar onLogout={logoutUser} />
      </aside>
      <ResizeHandle isDragging={isDragging} handleProps={handleProps} />

      {/* Right column: header + main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="bg-muted/30 flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger menu */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger
                render={<Button variant="ghost" size="icon" className="md:hidden" aria-label={t('nav.menu')} />}
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" showCloseButton={false} className="bg-sidebar text-sidebar-foreground w-60 p-0">
                <SheetTitle className="sr-only">{t('nav.menu')}</SheetTitle>
                <Sidebar onClose={() => setSidebarOpen(false)} onLogout={logoutUser} />
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

      {/* Vault unlock dialog */}
      <VaultUnlockDialog />
    </div>
  )
}

export { ProtectedLayout }
