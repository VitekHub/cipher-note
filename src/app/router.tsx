import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { PageSkeleton } from '@/app/Pending'
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'
import type { AuthContext } from '@/shared/auth/auth-context'

function createAppRouter(auth: AuthContext) {
  const router = createRouter({
    routeTree,
    basepath: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
    context: { auth },
    defaultPendingComponent: PageSkeleton,
    defaultErrorComponent: RouteErrorBoundary,
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

export { createAppRouter }
