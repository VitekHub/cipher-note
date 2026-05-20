import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '@/features/settings/ui/SettingsPage'

const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

export { Route }
