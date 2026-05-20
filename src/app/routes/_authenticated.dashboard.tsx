import { createFileRoute } from '@tanstack/react-router'

import { DashboardPage } from '@/features/fields/ui/DashboardPage'

const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

export { Route }
