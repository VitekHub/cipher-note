import { render, renderHook } from '@testing-library/react'
import type { ReactNode, ReactElement } from 'react'
import { Suspense } from 'react'
import { afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/shared/lib/theme-provider'
import { AuthProvider } from '@/features/auth/ui/auth-provider'

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
})

afterEach(() => {
  testQueryClient.clear()
})

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={testQueryClient}>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <Suspense fallback={null}>{children}</Suspense>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function customRender(ui: ReactElement, options = {}) {
  return render(ui, { wrapper: AllProviders, ...options })
}

function customRenderHook<TResult>(hook: () => TResult, options = {}) {
  return renderHook(hook, { wrapper: AllProviders, ...options })
}

export { customRender as render, customRenderHook as renderHook }
export * from '@testing-library/react'
export * from '@testing-library/user-event'
