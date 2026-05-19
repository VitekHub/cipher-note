import { Navigate } from '@tanstack/react-router'
import { useAuth } from '@/shared/auth/auth-context'
import { PageSkeleton } from '@/app/Pending'

interface GuestOnlyProps {
  children: React.ReactNode
}

function GuestOnly({ children }: GuestOnlyProps) {
  const { isAuthenticated, isInitializing } = useAuth()

  if (isInitializing) {
    return <PageSkeleton />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" />
  }

  return <>{children}</>
}

export { GuestOnly }
