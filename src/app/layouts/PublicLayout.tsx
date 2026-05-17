import { Outlet } from '@tanstack/react-router'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'

function PublicLayout() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      <main className="container mx-auto flex min-h-screen items-center justify-center p-4">
        <Outlet />
      </main>
    </div>
  )
}

export { PublicLayout }
