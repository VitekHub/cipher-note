import { useMemo } from 'react'
import { AuthProvider, useAuth } from '@/shared/auth/auth-context'
import { RouterProvider } from '@tanstack/react-router'
import { createAppRouter } from './router'

function InnerApp() {
  const auth = useAuth()
  const router = useMemo(() => createAppRouter(auth), [auth])

  return <RouterProvider router={router} />
}

function AppProviders() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  )
}

export { AppProviders }
