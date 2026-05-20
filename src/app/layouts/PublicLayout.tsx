import { Outlet } from '@tanstack/react-router'
import { LanguageSwitcher } from '@/shared/ui/nav/LanguageSwitcher'

function PublicLayout() {
  return (
    <div className="bg-background text-foreground relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-primary)_0,_transparent_70%)] opacity-[0.08]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--color-primary)_0,_transparent_50%)] opacity-[0.03]" />
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
