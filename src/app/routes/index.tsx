import { createFileRoute, redirect } from '@tanstack/react-router'
import { lazy } from 'react'

const LandingPage = lazy(() => import('@/features/landing/ui/LandingPage'))

const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LandingPage,
})

export { Route }
