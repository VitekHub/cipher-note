import { Navigate, useLocation } from '@tanstack/react-router'
import { useAuth } from '@/shared/auth/auth-context'
import { PageSkeleton } from '@/app/Pending'

interface RequireAuthProps {
  children: React.ReactNode
}

function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <PageSkeleton />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" search={{ redirect: location.href }} />
  }

  return <>{children}</>
}

export { RequireAuth }
