import { createFileRoute } from '@tanstack/react-router'
import { RegisterPage } from '@/features/auth/ui/RegisterPage'

const Route = createFileRoute('/_public/register')({
  component: RegisterPage,
})

export { Route }
