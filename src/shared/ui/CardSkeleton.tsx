import { Card, CardContent, CardHeader } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

interface CardSkeletonProps {
  /** Number of content rows (default: 2) */
  rows?: number
  /** Title skeleton width class (default: 'w-40') */
  titleWidth?: string
  /** Description skeleton width class (default: 'w-64') */
  descriptionWidth?: string
}

function CardSkeleton({ rows = 2, titleWidth = 'w-40', descriptionWidth = 'w-64' }: CardSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={`h-6 ${titleWidth}`} />
        <Skeleton className={`mt-1.5 h-4 ${descriptionWidth}`} />
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i}>
            {i > 0 && <Skeleton className="my-3 h-px w-full" />}
            <Skeleton className="h-14 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export { CardSkeleton }
