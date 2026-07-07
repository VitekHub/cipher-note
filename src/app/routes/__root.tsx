import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { ThemeProvider } from '@/shared/lib/theme-provider'
import { Toaster } from '@/shared/ui/sonner'
import { PageSkeleton } from '@/app/Pending'
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'
import { NotFoundPage } from '@/app/NotFoundPage'
import { PreAlphaBanner } from '@/shared/ui/PreAlphaBanner'
import type { AuthContext } from '@/shared/auth/auth-context'

interface RouterContext {
  auth: AuthContext
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: NotFoundPage,
  pendingComponent: PageSkeleton,
})

function RootLayout() {
  return (
    <ThemeProvider defaultTheme="dark">
      <PreAlphaBanner />
      <Outlet />
      <Toaster />
    </ThemeProvider>
  )
}
