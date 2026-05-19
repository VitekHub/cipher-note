import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/shared/auth/auth-context'
import { RouterProvider } from '@tanstack/react-router'
import { createAppRouter } from './router'
import { initializeAuth, subscribeToAuthChanges } from '@/features/auth/model/auth-credentials'
import { PageSkeleton } from '@/app/Pending'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function InnerApp() {
  const auth = useAuth()
  const [router] = useState(() => createAppRouter(auth))

  router.update({ context: { auth } })

  useEffect(() => {
    initializeAuth()
    const unsubscribe = subscribeToAuthChanges()
    return () => {
      unsubscribe()
    }
  }, [])

  if (auth.isInitializing) {
    return <PageSkeleton />
  }

  return <RouterProvider router={router} />
}

function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export { AppProviders, queryClient }
