import { cn } from '@/shared/lib/utils'

interface ResizeHandleProps {
  isDragging: boolean
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void
    onKeyDown: (e: React.KeyboardEvent) => void
  }
}

function ResizeHandle({ isDragging, handleProps }: ResizeHandleProps) {
  return (
    <div
      {...handleProps}
      data-slot="resize-handle"
      className={cn(
        'group absolute top-0 bottom-0 left-0 z-10 hidden w-3 cursor-col-resize select-none md:flex md:flex-col md:items-center md:justify-center',
        'hover:bg-sidebar-primary/20 active:bg-sidebar-primary/30 focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
        'transition-colors duration-150',
        isDragging && 'bg-sidebar-primary/30',
      )}
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
    >
      <div className="absolute inset-y-0 -left-1 w-3" />
      <div className="flex flex-col items-center gap-0.75">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-0.75">
            {Array.from({ length: 2 }, (_, j) => (
              <span
                key={`${i}-${j}`}
                className="bg-sidebar-foreground/25 group-hover:bg-sidebar-foreground/50 size-0.5 rounded-full transition-colors"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export { ResizeHandle }
