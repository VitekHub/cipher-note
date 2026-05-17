import { render } from '@testing-library/react'
import type { ReactNode, ReactElement } from 'react'
import { Suspense } from 'react'
import { ThemeProvider } from '@/shared/lib/theme-provider'
import { AuthProvider } from '@/shared/auth/auth-context'

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark">
      <AuthProvider>
        <Suspense fallback={null}>{children}</Suspense>
      </AuthProvider>
    </ThemeProvider>
  )
}

function customRender(ui: ReactElement, options = {}) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export { customRender as render }
export * from '@testing-library/react'
export * from '@testing-library/user-event'
