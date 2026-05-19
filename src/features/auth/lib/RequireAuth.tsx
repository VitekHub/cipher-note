import { Navigate, useLocation } from '@tanstack/react-router'
import { useAuth } from '@/shared/auth/auth-context'
import { PageSkeleton } from '@/app/Pending'

interface RequireAuthProps {
  children: React.ReactNode
}

function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, isRestoringSession } = useAuth()

  if (isRestoringSession) {
    return <PageSkeleton />
  }

  if (!isAuthenticated) {
    return <RequireAuthRedirect />
  }

  return <>{children}</>
}

function RequireAuthRedirect() {
  const location = useLocation()
  return <Navigate to="/login" search={{ redirect: location.href }} />
}

export { RequireAuth }
