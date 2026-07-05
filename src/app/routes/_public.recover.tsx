import { createFileRoute } from '@tanstack/react-router'
import { RecoverPage } from '@/features/auth/ui/RecoverPage'

function RecoverRoute() {
  return <RecoverPage />
}

export const Route = createFileRoute('/_public/recover')({
  component: RecoverRoute,
})
