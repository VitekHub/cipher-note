import { createFileRoute } from '@tanstack/react-router'
import { RegisterPage } from '@/features/auth/ui/RegisterPage'
import { signUpUser } from '@/app/flows/auth-flow'

const Route = createFileRoute('/_public/register')({
  component: () => <RegisterPage onSubmit={signUpUser} />,
})

export { Route }
