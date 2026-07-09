import { Outlet } from '@tanstack/react-router'
import { PublicHeader } from '@/shared/ui/nav/PublicHeader'

function PublicLayout() {
  return (
    <div className="bg-background text-foreground relative flex min-h-dvh [scrollbar-gutter:stable] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)_0,transparent_70%)] opacity-[0.08]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,var(--color-primary)_0,transparent_50%)] opacity-[0.03]" />
      <PublicHeader />
      <main className="container mx-auto flex justify-center px-4 py-8 md:flex-1 md:items-center">
        <Outlet />
      </main>
    </div>
  )
}

export { PublicLayout }
