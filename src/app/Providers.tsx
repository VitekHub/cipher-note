import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/ui/auth-provider'
import { useAuth } from '@/shared/auth/auth-context'
import { RouterProvider } from '@tanstack/react-router'
import { createAppRouter } from './router'
import { restoreSession, subscribeToAuthChanges } from '@/features/auth/model/auth-service'
import { setQueryClient } from '@/shared/crypto/vault/crypto-store'
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

setQueryClient(queryClient)

function InnerApp() {
  const auth = useAuth()
  const [router] = useState(() => createAppRouter(auth))

  router.update({ context: { auth } })

  useEffect(() => {
    restoreSession()
    const unsubscribe = subscribeToAuthChanges(() => {
      router.navigate({ to: '/login' })
    })
    return () => {
      unsubscribe()
    }
  }, [router])

  if (auth.isRestoringSession) {
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
