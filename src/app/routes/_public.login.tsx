import { createFileRoute, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginPage } from '@/features/auth/ui/LoginPage'

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

type LoginSearch = z.infer<typeof loginSearchSchema>

function LoginRoute() {
  const search = useSearch({ strict: false }) as LoginSearch
  return <LoginPage redirectUrl={search.redirect} />
}

const Route = createFileRoute('/_public/login')({
  component: LoginRoute,
  validateSearch: loginSearchSchema,
})

export { Route }
