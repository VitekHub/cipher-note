import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import { Outlet, useBlocker } from '@tanstack/react-router'

import { Button } from '@/shared/ui/button'
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/shared/ui/sheet'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { ResizeHandle } from '@/shared/ui/nav/ResizeHandle'
import { VaultIndicator } from '@/features/vault/ui/VaultIndicator'
import { VaultUnlockDialog } from '@/features/vault/ui/VaultUnlockDialog'
import { ChangePasswordDialog } from '@/features/auth/ui/ChangePasswordDialog'
import { RegenerateMnemonicDialog } from '@/features/auth/ui/RegenerateMnemonicDialog'
import { OfflineBanner } from '@/shared/ui/OfflineBanner'
import { useLayoutStore } from './layout-store'
import { useResizable } from '@/shared/lib/use-resizable'
import { useVaultTimeout } from '@/features/vault/model/use-vault-timeout'
import { logoutUser } from '@/features/auth/model/auth-service'
import { useRealtimeSync } from '@/features/fields/model/use-realtime-sync'
import { useNavigationBlocker } from '@/features/fields/model/use-navigation-blocker'
import { useAuth } from '@/shared/auth/auth-context'

/**
 * Thin wrapper that guards the authenticated layout.
 * Returns null during the logout transition so auth-dependent hooks
 * in AuthenticatedLayout never run without a user.
 */
function ProtectedLayout() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return null
  return <AuthenticatedLayout />
}

/** The full authenticated shell — only mounted when a user is present. */
function AuthenticatedLayout() {
  const { t } = useTranslation('common')
  const sidebarOpen = useLayoutStore((s) => s.sidebarOpen)
  const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen)
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth)
  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth)
  const {
    width: currentSidebarWidth,
    isDragging,
    handleProps,
  } = useResizable({
    storedWidth: sidebarWidth,
    onWidthChange: setSidebarWidth,
  })

  useVaultTimeout()
  useRealtimeSync()
  useBlocker({
    shouldBlockFn: () => !navigator.onLine,
    enableBeforeUnload: false,
    withResolver: false,
  })
  useNavigationBlocker()

  return (
    <div className="text-foreground bg-background flex h-[calc(100vh-var(--banner-height))]">
      {/* Desktop sidebar */}
      <aside
        className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden shrink-0 flex-col border-r md:flex"
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

        {/* Offline status banner */}
        <OfflineBanner />

        {/* Main content */}
        <main className="mb-10 flex flex-1 flex-col overflow-y-auto p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />

      {/* Dialogs */}
      <VaultUnlockDialog />
      <ChangePasswordDialog />
      <RegenerateMnemonicDialog />
    </div>
  )
}

export { ProtectedLayout }
