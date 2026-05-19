function PageSkeleton() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-4">
        <div className="bg-muted h-8 w-3/4 animate-pulse rounded" />
        <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
        <div className="space-y-3">
          <div className="bg-muted h-10 animate-pulse rounded" />
          <div className="bg-muted h-10 animate-pulse rounded" />
          <div className="bg-muted h-10 w-1/3 animate-pulse rounded" />
        </div>
      </div>
    </div>
  )
}

function AuthPageSkeleton() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-lg border p-6 shadow-sm">
          <div className="space-y-2">
            <div className="bg-muted h-7 w-1/2 animate-pulse rounded" />
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
          </div>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <div className="bg-muted h-4 w-1/4 animate-pulse rounded" />
              <div className="bg-muted h-10 animate-pulse rounded" />
            </div>
            <div className="space-y-2">
              <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />
              <div className="bg-muted h-10 animate-pulse rounded" />
            </div>
            <div className="bg-muted h-10 w-full animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="bg-background flex min-h-screen">
      <aside className="hidden w-60 border-r md:block">
        <div className="p-4">
          <div className="bg-muted h-6 w-2/3 animate-pulse rounded" />
        </div>
        <div className="mt-6 space-y-2 px-4">
          <div className="bg-muted h-8 animate-pulse rounded" />
          <div className="bg-muted h-8 animate-pulse rounded" />
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="space-y-4">
          <div className="bg-muted h-6 w-1/4 animate-pulse rounded" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-muted h-40 animate-pulse rounded-lg" />
            <div className="bg-muted h-40 animate-pulse rounded-lg" />
            <div className="bg-muted h-40 animate-pulse rounded-lg" />
          </div>
        </div>
      </main>
    </div>
  )
}

export { PageSkeleton, AuthPageSkeleton, DashboardSkeleton }
