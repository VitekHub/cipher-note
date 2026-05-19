import { createFileRoute, redirect } from '@tanstack/react-router'
import { ProtectedLayout } from '@/app/layouts/ProtectedLayout'
import { DashboardSkeleton } from '@/app/Pending'

const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: ProtectedLayout,
  pendingComponent: DashboardSkeleton,
})

export { Route }
