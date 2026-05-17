import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { PageSkeleton } from '@/app/pending'
import { RootErrorBoundary } from '@/app/error-boundary'
import type { AuthContext } from '@/shared/auth/auth-context'

function createAppRouter(auth: AuthContext) {
  const router = createRouter({
    routeTree,
    context: { auth },
    defaultPendingComponent: PageSkeleton,
    defaultErrorComponent: RootErrorBoundary,
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
