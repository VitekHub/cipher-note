import { Skeleton } from '@/shared/ui/skeleton'

function CenteredPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <CenteredPage>
      <div className="space-y-6 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10 w-1/3" />
        </div>
      </div>
    </CenteredPage>
  )
}

function FormFieldSkeleton({ labelWidth }: { labelWidth: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={`h-4 ${labelWidth}`} />
      <Skeleton className="h-10" />
    </div>
  )
}

function AuthPageSkeleton() {
  return (
    <CenteredPage>
      <div className="rounded-lg border p-6 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="mt-6 space-y-4">
          <FormFieldSkeleton labelWidth="w-1/4" />
          <FormFieldSkeleton labelWidth="w-1/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </CenteredPage>
  )
}

function DashboardSkeleton() {
  return (
    <div className="bg-background flex min-h-screen">
      <aside className="hidden w-60 border-r md:block">
        <div className="p-4">
          <Skeleton className="h-6 w-2/3" />
        </div>
        <div className="mt-6 space-y-2 px-4">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6 pb-20 md:pb-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/4" />
          <div className="grid gap-4 *:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="ring-foreground/10 rounded-xl p-4 ring-1">
                <Skeleton className="mb-3 h-4 w-1/3" />
                <Skeleton className="h-32" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export { PageSkeleton, AuthPageSkeleton, DashboardSkeleton }
