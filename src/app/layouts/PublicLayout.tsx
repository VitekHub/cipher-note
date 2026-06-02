import { Outlet } from '@tanstack/react-router'
import { PublicHeader } from '@/shared/ui/nav/PublicHeader'

function PublicLayout() {
  return (
    <div className="bg-background text-foreground relative flex min-h-[calc(100vh-var(--banner-height))] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-primary)_0,_transparent_70%)] opacity-[0.08]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--color-primary)_0,_transparent_50%)] opacity-[0.03]" />
      <PublicHeader />
      <main className="container mx-auto flex flex-1 items-center justify-center p-4">
        <Outlet />
      </main>
    </div>
  )
}

export { PublicLayout }
