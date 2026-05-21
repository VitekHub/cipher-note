import { createFileRoute } from '@tanstack/react-router'
import { RegisterPage } from '@/features/auth/ui/RegisterPage'
import { handleRegister } from '@/app/flows/registration-flow'

const Route = createFileRoute('/_public/register')({
  component: () => <RegisterPage onSubmit={handleRegister} />,
})

export { Route }
