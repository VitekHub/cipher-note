import { createFileRoute } from '@tanstack/react-router'
import { RegisterPage } from '@/features/auth/ui/RegisterPage'
import { signUpUser } from '@/features/auth/model/auth-service'

const Route = createFileRoute('/_public/register')({
  component: () => <RegisterPage onSubmit={signUpUser} />,
})

export { Route }
