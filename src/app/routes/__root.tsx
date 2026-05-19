import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { ThemeProvider } from '@/shared/lib/theme-provider'
import { Toaster } from '@/shared/ui/sonner'
import { PageSkeleton } from '@/app/Pending'
import { RootErrorBoundary } from '@/app/ErrorBoundary'
import type { AuthContext } from '@/shared/auth/auth-context'

interface RouterContext {
  auth: AuthContext
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootErrorBoundary,
  pendingComponent: PageSkeleton,
})

function RootLayout() {
  return (
    <ThemeProvider defaultTheme="dark">
      <Outlet />
      <Toaster />
    </ThemeProvider>
  )
}
