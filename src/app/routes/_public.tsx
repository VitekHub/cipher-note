import { createFileRoute, redirect } from '@tanstack/react-router'
import { PublicLayout } from '@/app/layouts/PublicLayout'
import { AuthPageSkeleton } from '@/app/Pending'

const Route = createFileRoute('/_public')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: PublicLayout,
  pendingComponent: AuthPageSkeleton,
})

export { Route }
